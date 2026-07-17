import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import Moveable from "react-moveable";
import { useDispatch, useSelector } from "react-redux";
import {
  getActiveObject,
  getActiveObjectprops,
  getActiveObjects,
  getCurrentActivePageObjects,
  getZoom,
  getDragger,
  getCanvasSize,
  getCanvasScale,
} from "../../library/utils/helpers";
import {
  setCurrentObjectProperties,
  deSelectActiveObject,
  updateMultipleObjects,
  removeMultipleObjectsInPage,
  selectAllObjects,
  setActiveObject,
} from "../../store/slices/canvas";
import { flushSync } from "react-dom";
import ImageSettings from "../popups/ImageSettingsPopover";
import ObjectProperty from "../popups/ObjectPropertiesPopover";
import { createPortal } from "react-dom";
import MultiSelectToolbar from "../popups/MultiSelectToolbar";
import { Controls } from "three";
import { TbZoomMoney } from "react-icons/tb";
import { USER_TYPES } from "../../library/utils/constants/index.js";
import { applyLiveObjectTransform } from "../../library/utils/image/progressiveImage";
import { setLiveResize, clearLiveResize } from "./liveResizeStore";

// A rotation is "sane" if it's a finite angle within a few full turns. Anything
// beyond that is corruption (a runaway gesture compounded the angle into the
// 1e20+ range, where float64 can no longer represent small increments → the
// object becomes un-rotatable). ROTATION_SANE_LIMIT is far above any real edit
// (10 full turns) so legitimate values pass through untouched.
const ROTATION_SANE_LIMIT = 3600;
// The multi-select toolbar is centred on the selection's X. That centre-X sits
// exactly on the group rotate handle, so the toolbar's left edge covers it. Nudge
// the toolbar right by this many px so the rotate dragger stays clickable.
const MULTISELECT_TOOLBAR_X_OFFSET = 40;
const isSaneRotation = (r) => Number.isFinite(r) && Math.abs(r) <= ROTATION_SANE_LIMIT;
// Fold a corrupted/huge angle back into [0, 360). For an ordinary value this is a
// no-op path (callers gate on !isSaneRotation first).
const normalizeRotation = (r) =>
  Number.isFinite(r) ? ((r % 360) + 360) % 360 : 0;

const ItemDragger = () => {
  const dispatch = useDispatch();
  const activeObject = useSelector(getActiveObject);
  const currentActiveObject = useSelector(getActiveObjectprops);
  const activeObjects = useSelector(getActiveObjects); // multi-select array
  const zoomRatio = useSelector(getZoom);
  const canvasSize = useSelector(getCanvasSize);
  // The canvas-box uses `transform: scale(canvasScale)` for user-zoom. Moveable
  // lives INSIDE that transform, so its 1px lines get scaled too. Its `zoom` prop
  // is the INVERSE scale: at 50% (scale 0.5) we pass 2 so lines render 2px local →
  // a true 1px on screen (Firefox rounds sub-1px lines to 0 → vanishing borders).
  const canvasScale = useSelector(getCanvasScale);
  const moveableZoom = 1 / (canvasScale || 1);
  const getActivepageObjects = useSelector(getCurrentActivePageObjects);
  //     const dispatch = useDispatch
  const [elementGuidelines, setElementGuidelines] = useState([]);
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const [targetWidth, setTargetWidth] = useState("");
  const [targetHeight, setTargetHeight] = useState("");
  const [resizeTranslate, setResizeTranslate] = useState("");
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
  const [initialRotation, setInitialRotation] = useState(0);
  const [initialImagePositionX, setInitialImagePositionX] = useState(0);
  const [initialImagePositionY, setInitialImagePositionY] = useState(0);

  const [isUpdatingObject, setIsUpdatingObject] = useState(false);
  const [textFontSize, setTextFontSize] = useState(0);
  const [keepratio, setKeepratio] = useState(false);
  const [defaultTextWidth, setDefaultTextWidth] = useState(0);
  const [defaultFontSize, setDefaultFontSize] = useState(0);
  const moveableRef = useRef(null);
  // Separate ref for the multi-target Moveable so both can coexist
  const groupMoveableRef = useRef(null);
  const isDragger = useSelector(getDragger);
  const [deviceWidth, setDeviceWidth] = useState(0);
  const [deviceHeight, setDeviceHeight] = useState(0);
  const [isAdjustable, setIsAdjustable] = useState(false);
  const [multiSelectToolbarPos, setMultiSelectToolbarPos] = useState({ top: 0, left: 0 });
  const groupResizeSnapshotRef = useRef({});
  // ── Group-gesture imperative state (ports the single-object perf paths) ──────
  // True only while a GROUP RESIZE gesture is in progress. Routes onGroupTransformEnd
  // to the resize branch (commit width/height/image/font + clearLiveResize) vs the
  // drag/rotate branch (commit x/y/rotation). Drag/rotate are applied imperatively
  // (cssText + footer mirror) and resize pushes per-member liveResize — NEITHER
  // dispatches per frame, so MainCanvas never re-renders mid-gesture (the lag).
  const isGroupResizingRef = useRef(false);
  // Each member's rotation at gesture start (id -> degrees). Used to mirror the
  // footer copies on drag-only frames (Moveable reports rotate=null → mirroring 0
  // would un-rotate an already-rotated member) and during resize (the gesture's
  // mid-resize rotate can read 0).
  const groupBaseRotationRef = useRef(new Map());
  // Live geometry stashes committed ONCE on gesture end (id -> update). Drag/rotate
  // stash {x,y,rotation}; resize stashes {width,height,image?,font?,transform?}.
  const groupDragUpdatesRef = useRef(new Map());
  const groupResizeUpdatesRef = useRef(new Map());
  // True only while a single-object ROTATE gesture is live. Redux is frozen during
  // the imperative rotate, so onRender writes the live angle straight to the
  // ∠° readout DOM node (gated by this) and it re-syncs to the committed value on end.
  const isRotatingRef = useRef(false);
  // True ONLY while the rotation-sync effect is imperatively driving Moveable's
  // rotatable able to make the selection box follow an EXTERNAL rotation change
  // (Position panel presets / slider / input). In react-moveable an instant
  // request() runs the FULL onRotateStart→onRender→onRotateEnd cycle, so without
  // this guard onRotateEnd would flushOnRenderNow() and COMMIT a Moveable-measured
  // (radian round-tripped, pivot-adjusted) angle back to Redux — overwriting the
  // exact value the panel just set with a slightly/wildly different one (the
  // "picked 45° but the slider snaps to another value" bug). While this is true
  // the rotate handlers no-op, so the sync moves the BOX only, never the DATA.
  const isSyncingRotationRef = useRef(false);
  // onRender dispatch throttling: apply the visual transform on every frame but
  // coalesce the redux dispatch to one per animation frame. This breaks the
  // flushSync synchronous re-render → re-fire loop ("Maximum update depth") and
  // removes the per-event dispatch flood that caused rotate/drag lag.
  const onRenderRafRef = useRef(null);
  const onRenderLatestRef = useRef(null);
  // True only while a RESIZE gesture is in progress. Drag/rotate are applied
  // imperatively (cssText) and committed to redux once on gesture end, so they
  // dispatch NOTHING per frame (which is what re-rendered the whole MainCanvas
  // ~60x/sec). Resize's size visual comes from redux width/height, so it must
  // keep dispatching during the gesture — gated on this flag.
  const isResizingRef = useRef(false);
  // Imperative (no-redux-per-frame) resize. During the gesture we push the live
  // geometry to the per-object liveResizeStore — only the resized object's
  // renderer re-renders, NOT the heavy MainCanvas (the resize lag was MainCanvas
  // re-rendering synchronously on every per-frame dispatch). Committed to redux
  // ONCE on gesture end. isImperativeResizeRef gates this path (currently images);
  // resizeWorkingRef holds the evolving geometry so the image-cover math chains
  // frame-to-frame the same way the old per-dispatch flushSync chain did (redux is
  // frozen during the gesture, so we can't read the live object as the base).
  const isImperativeResizeRef = useRef(false);
  const resizeWorkingRef = useRef(null);
  // True for the whole span of ANY Moveable canvas gesture (drag / rotate /
  // resize). Set in the *Start handlers, cleared one frame after the *End
  // handlers. The rotation-sync effect below uses this (plus lastGestureRotationRef)
  // to NEVER re-drive Moveable's rotatable able from a rotation that a canvas
  // gesture itself produced — doing so mid/at-gesture-end stranded the able live
  // (object spun following the cursor) and nulled its drag `datas`
  // ("Cannot set properties of null (setting 'dist')").
  const isGesturingRef = useRef(false);
  // The last rotation value COMMITTED by a Moveable gesture (handle/keyboard).
  // The rotation-sync effect skips when activeRotation equals this — Moveable is
  // already at that angle, so re-requesting it is redundant and dangerous. Only a
  // change from an EXTERNAL source (Position-panel slider/input) differs from it,
  // which is exactly when the sync SHOULD run.
  const lastGestureRotationRef = useRef(null);

  const getActiveCanvasObjProps = useSelector(getActiveObjectprops);
  const activePageLayouts = useSelector(
    (state) => state.canvas.present.pages?.[state.canvas.present.activePageIndex]?.layout || []
  );
  const getObjects = getActivepageObjects?.length;

  // ── Multi-select mode flag ────────────────────────────────────────────────
  // True when 2+ objects are selected; the single-item toolbars hide themselves
  // by checking activeObject === null.
  const isMultiSelect = activeObjects.length > 1;

  // Resolve the DOM elements for every selected object (multi-select mode).
  // Use state + useEffect so DOM queries run after React commits new canvas objects
  // (useMemo runs during render, before DOM is updated — pasted objects won't be found).
  const [multiTargets, setMultiTargets] = useState([]);
  useLayoutEffect(() => {
    if (!isMultiSelect) {
      setMultiTargets([]);
      return;
    }
    const targets = activeObjects
      .map(({ id }) => document.querySelector(`g[data-id-t="${id}"]`))
      .filter(Boolean);
    setMultiTargets(targets);
  }, [isMultiSelect, activeObjects]);

  // For single selection: activeObject may arrive without a .target (e.g., after
  // a shift-click that collapsed back to one item). Resolve it from the DOM.
  // Use state + useEffect so freshly pasted objects (not yet in DOM during render) are found.
  const [resolvedSingleTarget, setResolvedSingleTarget] = useState(null);
  useLayoutEffect(() => {
    if (!activeObject) {
      setResolvedSingleTarget(null);
      return;
    }
    if (activeObject.target && document.body.contains(activeObject.target)) {
      setResolvedSingleTarget(activeObject.target);
      return;
    }
    if (activeObject.id) {
      const el = document.querySelector(`g[data-id-t="${activeObject.id}"]`);
      setResolvedSingleTarget(el || null);
    }
  }, [activeObject]);
  const [labelObjectPropertyPosition, setLabelObjectPropertyPosition] =
    useState({ top: 0, left: 0 });
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  const [rotationPosition, setRotationPosition] = useState("top");
  const [isGoUp, setIsGoUp] = useState(null);
  const users = localStorage.getItem("userDetails");
  const userObj = JSON.parse(users);
  useEffect(() => {
    //  setElementGuidelines(prev => [...prev, document.querySelector(".WrapperDiv")]);
    // leftSide, rightSide class meed to be added to guidelines
    setElementGuidelines((prev) => [
      ...prev,
      document.querySelector(".leftSide"),
    ]);
    setElementGuidelines((prev) => [
      ...prev,
      document.querySelector(".rightSide"),
    ]);
    setElementGuidelines((prev) => [
      ...prev,
      document.querySelector(".page-item"),
    ]);
    setElementGuidelines((prev) => [
      ...prev,
      document.querySelector(".targetE1"),
    ]);

    // set device widht and height
    setDeviceWidth(window.innerWidth);
    setDeviceHeight(window.innerHeight);
  }, []);

  useEffect(() => {
    const targetElement = resolvedSingleTarget;

    if (activeObject?.target && !document.body.contains(activeObject.target)) {
      // Ghost selection (e.g. object deleted while selected via undo) — clean up
      moveableRef.current?.destroy();
      moveableRef.current = null;
      dispatch(deSelectActiveObject());
      return;
    }

    if (activeObject && targetElement && moveableRef.current) {
      updatePopoverPosition();
      updateLabelObjectPropertyPosition();
    }
  }, [activeObject, resolvedSingleTarget]);

  useEffect(() => {
    const updateMoveable = () => {
      // FIX: Crash on Undo when object is removed
      const targetElement = resolvedSingleTarget;
      if (getActiveCanvasObjProps && moveableRef.current && targetElement && document.body.contains(targetElement)) {
        moveableRef.current.updateRect();
        moveableRef.current.updateTarget();
      }
      // Keep group moveable in sync too
      if (groupMoveableRef.current && isMultiSelect) {
        groupMoveableRef.current.updateRect();
      }
    };

    const updateAll = () => {
      updateMoveable();
      updateLabelObjectPropertyPosition();
      updatePopoverPosition();
      updateMultiSelectToolbarPosition();
    };

    let rafId;
    const timeoutId = setTimeout(() => {
      rafId = requestAnimationFrame(updateAll);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [getActiveCanvasObjProps, zoomRatio, getActivepageObjects, isMultiSelect, resolvedSingleTarget, multiTargets]);

  // Dedicated rotation sync (Position settings panel: presets / slider / input).
  // The general update effect above is DEBOUNCED (setTimeout(10) that resets on
  // every change) so a slider drag never syncs until you pause; and updateRect()
  // alone does NOT rotate Moveable's selection box (Moveable keeps rotation as
  // internal state). This effect keys ONLY on the rotation value, runs immediately
  // (no debounce), and drives Moveable's rotatable able the exact way the rotate
  // handle / keyboard-rotate do — so the selection frame follows the object's
  // rotation live. Skipped during a live drag/resize gesture (rotation isn't
  // changing then and re-applying it would fight the imperative gesture).
  // When the selected object IDENTITY changes (or selection is cleared), forget the
  // last gesture rotation. A fresh Moveable may remount at 0° for the new object
  // while the memo still held the previous object's angle — the equality guard
  // below would then wrongly suppress the initial sync and leave the selection box
  // unrotated. Keyed on id ONLY (not the {id,areaType}→id shape normalization that
  // fires at gesture-end for freshly placed objects), and placed BEFORE the sync
  // effect so it resets first.
  const activeObjectId = activeObject?.id;
  useEffect(() => {
    lastGestureRotationRef.current = null;
  }, [activeObjectId]);

  // ── Heal corrupted rotation on selection ──────────────────────────────────
  // Objects poisoned by the old runaway-rotate bug carry an absurd stored angle
  // (e.g. 1e26°) that float64 can't increment, so their rotate handle appears
  // dead. When such an object becomes active, fold its angle back into [0,360)
  // once (history:false — a silent repair, not an undo step). After this the
  // rotation-sync effect drives Moveable to the fixed angle and the handle works.
  // Keyed on id only, so it runs once per selection and never loops (the repaired
  // value is sane → the guard below is false on the re-render).
  useEffect(() => {
    const r = getActiveCanvasObjProps?.transform?.rotation;
    if (r == null || isSaneRotation(r)) return;
    const fixed = normalizeRotation(r);
    dispatch(
      setCurrentObjectProperties({
        transform: { ...getActiveCanvasObjProps.transform, rotation: fixed },
        history: false,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeObjectId]);

  const activeRotation = getActiveCanvasObjProps?.transform?.rotation;
  // Reposition Moveable's selection box/handle when the rotation changes from an
  // EXTERNAL source (Position-panel presets / slider / custom input). We ONLY
  // updateRect() here — we must NOT replay the angle through
  // mv.request("rotatable", …). That request fires a full SYNTHETIC rotate gesture
  // whose onRotateEnd → flushOnRender commits Moveable's matrix-derived angle BACK
  // to redux, and that round-trip returned the WRONG angle (e.g. click 225° →
  // committed 135°), silently overwriting the clean preset value — the "clicking a
  // preset applies a different angle" bug. The object is already rendered at the
  // correct angle by React (redux → <g> style.transform); updateRect just
  // re-measures the selection box so the handle follows.
  useEffect(() => {
    if (isGesturingRef.current || isResizingRef.current || isDragger) return undefined;
    if (activeRotation === lastGestureRotationRef.current) return undefined;
    const mv = moveableRef.current;
    const target = resolvedSingleTarget;
    if (!mv || !target || !document.body.contains(target)) return undefined;
    if (!Number.isFinite(activeRotation)) return undefined;
    const rafId = requestAnimationFrame(() => {
      // request(..., true) is SYNCHRONOUS and fires the whole rotate event cycle;
      // flag it so our onRotate* handlers skip their Redux commits and this stays
      // a pure visual box update. Cleared in finally so a throw can't strand it.
      try {
        isSyncingRotationRef.current = true;
        mv.updateRect();
      } catch (e) {
        /* Moveable internal state not ready — ignore rather than crash. */
      } finally {
        isSyncingRotationRef.current = false;
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeRotation, resolvedSingleTarget, isDragger]);

  // Eliminate the selection-box lag during an inner-image pan. Moveable's box
  // tracks the target's bounding box (which DOES move with the panning photo),
  // but the general update effect re-measures on a setTimeout(10)+rAF throttle —
  // so the box reads the photo's position a frame or two late (the "delay").
  // useLayoutEffect runs synchronously AFTER the photo's DOM update and BEFORE
  // paint, so re-measuring here lands the box in the same frame as the photo —
  // no visible lag. Only while panning (isDragger); onRender bails on isDragger,
  // so updateRect just repositions the overlay (no dispatch, no loop).
  useLayoutEffect(() => {
    const measure = () => {
      const target = resolvedSingleTarget;
      if (moveableRef.current && target && document.body.contains(target)) {
        moveableRef.current.updateRect();
      }
    };
    if (!isDragger) {
      // Pan ended — including a mere click on the pan handle (press+release with
      // no drag). The press briefly showed the GhostImage, which EXPANDS the
      // object's bounding box; on release the ghost is removed and the box must
      // snap back. Re-measure now AND next frame (so it catches the bbox after
      // the ghost is fully removed) — otherwise the selection box stays oversized.
      measure();
      const rafId = requestAnimationFrame(measure);
      return () => cancelAnimationFrame(rafId);
    }
    // During an inner-image pan the photo now moves IMPERATIVELY (no per-frame
    // redux dispatch), so this effect can no longer rely on getActiveCanvasObjProps
    // changing each frame to re-measure. Run a rAF loop while panning so the
    // selection box tracks the moving photo's bounding box every frame. Only
    // ItemDragger/Moveable re-renders here — the heavy MainCanvas does not.
    let rafId;
    const tick = () => {
      measure();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isDragger, resolvedSingleTarget]);

  // Keep moveable in sync during layout transitions (sidebar / footer toggle, window resize).
  // We store the "update everything" callback in a ref so the ResizeObserver
  // closure always calls the latest version without needing to reconnect on each render.
  const layoutUpdateRef = useRef(null);
  layoutUpdateRef.current = () => {
    const targetElement = resolvedSingleTarget;
    if (moveableRef.current && targetElement && document.body.contains(targetElement)) {
      moveableRef.current.updateRect();
    }
    if (groupMoveableRef.current && isMultiSelect) {
      groupMoveableRef.current.updateRect();
    }
    updateLabelObjectPropertyPosition();
    updatePopoverPosition();
    updateMultiSelectToolbarPosition();
  };

  useEffect(() => {
    const canvasWrapper = document.querySelector(".centerArea");
    const wrapperDiv = document.querySelector(".WrapperDiv");
    if (!canvasWrapper && !wrapperDiv) return;

    let rafId = null;
    const observer = new ResizeObserver(() => {
      // Debounce via rAF so we don't thrash during continuous transition frames
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => layoutUpdateRef.current?.());
    });
    if (canvasWrapper) observer.observe(canvasWrapper);
    if (wrapperDiv) observer.observe(wrapperDiv);

    // Final sync after the CSS sidebar-transition finishes (.WrapperDiv uses all 0.4s ease)
    const onTransitionEnd = () => requestAnimationFrame(() => layoutUpdateRef.current?.());
    if (wrapperDiv) wrapperDiv.addEventListener("transitionend", onTransitionEnd);

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      if (wrapperDiv) wrapperDiv.removeEventListener("transitionend", onTransitionEnd);
    };
  }, []); // ← stable: observer never needs to reconnect

  // Resolve an object from activePageLayouts by id + areaType.
  // Shared by keyboard handler and group transform handler.
  const resolveObjFromLayouts = useCallback((id, areaType) => {
    const arrKey = areaType === "safeArea" ? "safeAreaObjects" : "objects";
    for (const layout of activePageLayouts) {
      if (!layout) continue;
      const obj = layout[arrKey]?.find((o) => o.id === id);
      if (obj) return obj;
    }
    return null;
  }, [activePageLayouts]);

  // Find the SVG object id at a given screen coordinate.
  // Uses elementsFromPoint to pierce through Moveable's overlay divs
  // and locate the actual SVG [data-id-t] element underneath.
  const findObjectIdAtPoint = useCallback((x, y) => {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const match = el.closest?.("[data-id-t]") || (el.getAttribute?.("data-id-t") ? el : null);
      if (match) return match.getAttribute("data-id-t");
    }
    return null;
  }, []);

  // on delete key press remove the active object
  useEffect(() => {
    const BASE_SIZE = 1920; // Base size for standard movement
    const getMoveBy = (event) => {
      const maxCanvasSize = Math.max(canvasSize.width, canvasSize.height);
      const baseMoveBy =
        maxCanvasSize > BASE_SIZE ? maxCanvasSize / BASE_SIZE : 1;
      let moveBy = baseMoveBy;
      if (event.shiftKey) {
        moveBy = baseMoveBy * 10;
      }
      return moveBy;
    };

    function request(newTransform) {
      const mv = moveableRef.current;
      const target = resolvedSingleTarget;
      // Guard: a programmatic request() on a Moveable whose target was removed
      // or re-rendered (e.g. during the upload swap churn) initializes its drag
      // able with null internal state and throws "Cannot set properties of null
      // (setting 'dist')". Bail if the target isn't a live DOM node, and wrap the
      // calls so a transient bad state can never crash the editor.
      if (!mv || !target || !document.body.contains(target)) return;
      try {
        if (
          Number.isFinite(newTransform.x) &&
          Number.isFinite(newTransform.y)
        ) {
          mv.request("draggable", { x: newTransform.x, y: newTransform.y }, true);
        }
        if (newTransform.rotation) {
          mv.request("rotatable", { rotate: newTransform.rotation }, true);
        }
      } catch (err) {
        // Moveable internal state not ready — ignore rather than crash.
      }
    }

    const handleKeyPress = (event) => {
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      const activeElement = document.activeElement;

      const isInputFocused =
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT" ||
        activeElement.isContentEditable;

      // Ctrl+A / Cmd+A => select all objects on current page
      if ((event.ctrlKey || event.metaKey) && key === "a" && !isInputFocused) {
        event.preventDefault();
        dispatch(selectAllObjects());
        return;
      }

      // Display snap lines when Alt key is pressed
      if (event.ctrlKey) {
        setIsCtrlPressed(true);
        // moveableRef.current?.updateRect();
      }
      // Check if an object can be transformed (not locked, not disabled for customer)
      const isEditable = (obj) => {
        if (!obj || obj.locked) return false;
        if (userObj?.userTypeCode === USER_TYPES.CUSTOMER && obj.disabledForClient) return false;
        return true;
      };

      // Build transform updates for all editable multi-selected objects
      const buildMultiUpdates = (transformFn) =>
        activeObjects
          .map(({ id, areaType }) => {
            const obj = resolveObjFromLayouts(id, areaType);
            if (!isEditable(obj)) return null;
            return { id, areaType, transform: transformFn(obj) };
          })
          .filter(Boolean);

      // Arrow keys: move objects
      const isArrow = key === "arrowup" || key === "arrowdown" || key === "arrowleft" || key === "arrowright";
      if (isArrow && !isInputFocused) {
        const moveBy = getMoveBy(event);
        const dx = key === "arrowleft" ? -moveBy : key === "arrowright" ? moveBy : 0;
        const dy = key === "arrowup" ? -moveBy : key === "arrowdown" ? moveBy : 0;

        if (isMultiSelect) {
          event.preventDefault();
          const updates = buildMultiUpdates((obj) => ({
            x: (obj.transform?.x || 0) + dx,
            y: (obj.transform?.y || 0) + dy,
          }));
          if (updates.length) dispatch(updateMultipleObjects({ updates, history: false }));
        } else if (activeObject?.id && isEditable(currentActiveObject)) {
          const rect = moveableRef.current?.getRect?.();
          if (rect) request({ x: rect.left + dx, y: rect.top + dy });
        }
      } else if ((event.ctrlKey || event.metaKey) && !isInputFocused) {
        // Ctrl+[ / Ctrl+] : rotate
        if (key === "[" || key === "]") {
          const rotDelta = key === "[" ? -1 : 1;
          if (isMultiSelect) {
            event.preventDefault();
            const updates = buildMultiUpdates((obj) => ({
              rotation: (obj.transform?.rotation || 0) + rotDelta,
            }));
            if (updates.length) dispatch(updateMultipleObjects({ updates, history: false }));
          } else {
            const rect = moveableRef.current?.getRect?.();
            if (rect) request({ rotation: rect.rotation + rotDelta });
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [dispatch, activeObject, activeObjects, isMultiSelect, resolveObjFromLayouts, getActiveCanvasObjProps, currentActiveObject, userObj]);

  useEffect(() => {
    const newarr = Array.isArray(getActivepageObjects)
      ? getActivepageObjects[getActivepageObjects.length - 1]
      : null;
    // objTarget_2d8691e9-ef61-4b1f-8c4f-f797ea37287b
    if (newarr?.id) {
      // we have svg and inside it there is objects which need to be added to guidelines
      //lets get object by id and add it to guidelines
      // g tag has class name like objTarget_2d8691e9-ef61-4b1f-8c4f-f797ea37287b, so we can use this to get the object
      // get by class name and add it to guidelines
      let gtag = document.querySelector(`g.${"objTarget1_" + newarr?.id}`);

      if (!elementGuidelines.includes(gtag)) {
        setElementGuidelines((prev) => [...prev, gtag]);

        //setElementGuidelines(prev => [...prev, document.querySelector(".targetE1")]);
        //setElementGuidelines(prev => [...prev, gtag]);
      }
      // const element = document.querySelector(`div[data-id-t="${newarr?.id}"]`);
      // if (!elementGuidelines.includes(element)) {
      //     setElementGuidelines(prev => [...prev, element]);
      // }
    }
  }, [getObjects]);
  const updatePopoverPosition = () => {
    let popover = document.querySelector(".objectSettingsPopover");
    let centerArea = document.querySelector(".centerArea");
    let SidebarWrapper = document.querySelector(".sidebar-wrapper");
    let headerWrapper = document.querySelector("#header");
    let topActionWrapper = document.querySelector("#top-action-mob");
    if (resolvedSingleTarget && popover && centerArea) {
      const targetRect = resolvedSingleTarget.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const centerAreaRect = centerArea.getBoundingClientRect();
      const headerWrapperRect = headerWrapper?.getBoundingClientRect();
      const topActionWrapperRect = topActionWrapper?.getBoundingClientRect();
      let left =
        targetRect.left +
        window.scrollX +
        targetRect.width / 2 -
        popoverRect.width / 2;
      let top = targetRect.top + window.scrollY + targetRect.height + 10;

      // Ensure the popover stays within the center area
      if (left < centerAreaRect.left) {
        left = centerAreaRect.left;
      }
      if (left + popoverRect.width > centerAreaRect.right) {
        left = centerAreaRect.right - popoverRect.width - 10;
      }

      // Ensure the popover stays within the screen height
      if (top + popoverRect.height > window.innerHeight) {
        // set top to the top of the object
        top = currentActiveObject.transform.y * zoomRatio - 10;
      }

      //Ensure the popover stays under the header and top action wrapper
      const headerH = headerWrapperRect?.height || 0;
      const topActionH = topActionWrapperRect?.height || 0;
      if (top < headerH) {
        top = headerH + topActionH + 20;
      }

      // Ensure the popover stays within the screen width in mobile view
      if (window.innerWidth < 760 && left < 0) {
        left = 0;
      }

    }
  };
  const updateLabelObjectPropertyPosition = () => {
    let propertyPopover = document.querySelector(".labelObjectProperty");
    if (resolvedSingleTarget && propertyPopover) {
      const targetRect = resolvedSingleTarget.getBoundingClientRect();
      // const popoverRect = propertyPopover.getBoundingClientRect();
      setLabelObjectPropertyPosition({
        left: targetRect.left + window.scrollX + 15, // Keep the left position the same
        top: targetRect.top + window.scrollY - 28, // Keep the top position the same
      });
    }
  };

  // IMPERATIVE label-position update for use DURING a drag (per frame). Writes the
  // position straight to the DOM instead of setState. The setState version
  // re-renders ItemDragger → Moveable → the portals on EVERY drag frame, and that
  // per-frame React `Commit` is the drag lag. React still owns this element's
  // position via labelObjectPropertyPosition, but we don't setState during the
  // drag (so React never re-renders to overwrite this write), and onDragEnd's
  // updateLabelObjectPropertyPosition() syncs state to the final position.
  const updateLabelImperative = () => {
    const propertyPopover = document.querySelector(".labelObjectProperty");
    if (resolvedSingleTarget && propertyPopover) {
      const targetRect = resolvedSingleTarget.getBoundingClientRect();
      propertyPopover.style.left = `${targetRect.left + window.scrollX + 15}px`;
      propertyPopover.style.top = `${targetRect.top + window.scrollY - 28}px`;
    }
  };

  // Compute the bounding box of all multi-selected elements and position the
  // toolbar just above it so it floats over the entire selection.
  const updateMultiSelectToolbarPosition = useCallback(() => {
    if (!isMultiSelect || multiTargets.length === 0) return;
    let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity;
    multiTargets.forEach((el) => {
      if (!el || !document.body.contains(el)) return;
      const r = el.getBoundingClientRect();
      minTop = Math.min(minTop, r.top + window.scrollY);
      minLeft = Math.min(minLeft, r.left + window.scrollX);
      maxRight = Math.max(maxRight, r.right + window.scrollX);
    });
    if (minTop === Infinity) return;
    setMultiSelectToolbarPos({
      top: minTop - 48, // 48 px above the selection
      // horizontally centred, then nudged right so it clears the group rotate handle
      left: minLeft + (maxRight - minLeft) / 2 + MULTISELECT_TOOLBAR_X_OFFSET,
    });
  }, [isMultiSelect, multiTargets]);

  // When multiTargets populates (e.g. after paste), position toolbar and refresh Moveable.
  useEffect(() => {
    if (multiTargets.length > 1) {
      updateMultiSelectToolbarPosition();
      if (groupMoveableRef.current) {
        groupMoveableRef.current.updateRect();
      }
    }
  }, [multiTargets, updateMultiSelectToolbarPosition]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP (MULTI-SELECT) HANDLERS
  // react-moveable fires these when target is an array of elements.
  // Each `events` entry mirrors a single-object event for one target.
  // ═══════════════════════════════════════════════════════════════════════════

  // Capture each selected member's rotation (degrees) at gesture start so the
  // footer mirror + resize position use the object's REAL angle, never the
  // gesture's rotate (which reads null on a drag frame and 0 mid-resize).
  const captureGroupBaseRotations = useCallback(() => {
    const map = new Map();
    activeObjects.forEach(({ id, areaType }) => {
      const obj = resolveObjFromLayouts(id, areaType);
      map.set(id, obj?.transform?.rotation || 0);
    });
    groupBaseRotationRef.current = map;
  }, [activeObjects, resolveObjFromLayouts]);

  // Live visual update during DRAG / ROTATE group gestures (imperative, no dispatch).
  // Resize is handled entirely by onResizeGroup — bail here if a resize is in
  // progress (onRenderGroup may or may not fire during a group resize depending on
  // the react-moveable build; either way position/size are owned by onResizeGroup,
  // so we must not double-apply or record stale drag values from it).
  const onRenderGroup = useCallback(({ events }) => {
    if (isDragger || isGroupResizingRef.current) return;
    events.forEach(({ target, cssText, transformObject }) => {
      // Canvas copy: apply the full CSS transform string for instant feedback.
      target.style.cssText += cssText;
      const id = target.getAttribute("data-id-t");
      const activeObj = activeObjects.find((o) => o.id === id);
      const x = transformObject.translate[0];
      const y = transformObject.translate[1];
      // rotate is radians when the gesture is rotating; null on a drag-only frame.
      const rotationDeg = transformObject.rotate != null
        ? transformObject.rotate * (180 / Math.PI)
        : null;
      // Footer copies read from redux (frozen during the gesture). Mirror the move
      // imperatively; on a drag-only frame use the captured base rotation so an
      // already-rotated member doesn't visibly un-rotate in the footer.
      const mirrorRotation = rotationDeg != null
        ? rotationDeg
        : (groupBaseRotationRef.current.get(id) || 0);
      applyLiveObjectTransform(id, x, y, mirrorRotation, target.ownerSVGElement);
      // Stash for the single end-commit. PERSIST the last non-null rotation: a group
      // rotate can report rotate=null on some frames (incl. the final one), and since
      // redux is untouched mid-gesture, committing {x,y}-only would deep-merge onto
      // the PRE-gesture angle (0) → the object snaps straight after commit. Keeping
      // the last seen angle means the commit always carries the real rotation. A pure
      // drag never sets rotation (stays null) → commit x/y only, preserving the angle.
      const prevStash = groupDragUpdatesRef.current.get(id);
      const stashRotation = rotationDeg != null ? rotationDeg : (prevStash?.rotation ?? null);
      groupDragUpdatesRef.current.set(id, {
        id,
        areaType: activeObj?.areaType,
        x,
        y,
        rotation: stashRotation,
      });
    });
    // NO setState here. The multi-select toolbar is HIDDEN during the gesture
    // (visibility gated on isUpdatingObject), so repositioning it per frame is
    // invisible — and setMultiSelectToolbarPos would re-render ItemDragger + the
    // group Moveable every frame (Moveable re-measures all targets), which is the
    // group-gesture lag. It's repositioned once in onGroupTransformEnd. This
    // handler is now fully imperative (DOM + refs only), exactly like the smooth
    // single-object onRender.
  }, [isDragger, activeObjects]);

  // Live visual update during a GROUP RESIZE (imperative, no dispatch). Size goes
  // to each member's liveResize store (its renderer reflows; MainCanvas doesn't);
  // position (top/left/corner anchors) is applied here from drag.beforeTranslate —
  // NOT relying on onRenderGroup, which isn't guaranteed to fire during a resize.
  const onResizeGroup = useCallback(({ events }) => {
    if (isDragger) return;
    events.forEach((ev) => {
      const { target, width, height, drag } = ev;
      const id = target.getAttribute("data-id-t");
      const activeObj = activeObjects.find((o) => o.id === id);
      const snapshot = groupResizeSnapshotRef.current[id];
      const beforeTranslate = drag?.beforeTranslate;
      const transformUpdate = beforeTranslate ? {
        x: beforeTranslate[0],
        y: beforeTranslate[1],
      } : undefined;

      // Live overrides must be COMPLETE objects (the renderer shallow-merges
      // {...raw, ...live} — a bare {size} would drop family/weight). The commit
      // stash uses PARTIALS (the reducer deep-merges transform/font/image).
      let liveFont, commitFont, liveImage, commitImage;

      // ── Text: scale font proportionally ──
      if (
        snapshot?.type === "text" &&
        Number.isFinite(snapshot.fontSize) &&
        snapshot.fontSize > 0 &&
        snapshot.width > 0 &&
        snapshot.height > 0
      ) {
        const widthScale = width / snapshot.width;
        const heightScale = height / snapshot.height;
        const scaleFactor = (widthScale + heightScale) / 2;
        const nextFontSize = Math.max(1, Math.round(snapshot.fontSize * scaleFactor));
        commitFont = { size: nextFontSize };
        liveFont = { ...(snapshot.font || {}), size: nextFontSize };
      }

      // ── Image: scale the inner image so it still fills the resized frame ──
      if (snapshot?.type === "img" && snapshot.width > 0 && snapshot.height > 0) {
        const wRatio = width / snapshot.width;
        const hRatio = height / snapshot.height;
        // Scale image proportionally using the dominant axis
        let newScale = snapshot.imageScale * Math.max(wRatio, hRatio);
        // Guarantee cover — image must never be smaller than the frame
        newScale = Math.max(newScale, width / snapshot.imageNatW, height / snapshot.imageNatH);
        // Scale the pan offsets proportionally so the crop point stays consistent
        const newPosX = snapshot.imagePosX * wRatio;
        const newPosY = snapshot.imagePosY * hRatio;
        commitImage = {
          width: snapshot.imageNatW,
          height: snapshot.imageNatH,
          scale: newScale,
          positionX: newPosX,
          positionY: newPosY,
        };
        liveImage = { ...(snapshot.imageFull || {}), ...commitImage };
      }

      // Push the live size (+ complete font/image) to this member's renderer.
      setLiveResize(id, {
        width,
        height,
        ...(liveImage ? { image: liveImage } : {}),
        ...(liveFont ? { font: liveFont } : {}),
      });

      // Apply the live position to the canvas copy (SVG <g> reflows size via
      // liveResize; the wrapper transform carries position + the unchanged angle)
      // and mirror it to the footer copies.
      if (beforeTranslate) {
        const baseRot = groupBaseRotationRef.current.get(id) || 0;
        target.style.transform =
          `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px) rotate(${baseRot}deg)`;
        applyLiveObjectTransform(id, beforeTranslate[0], beforeTranslate[1], baseRot, target.ownerSVGElement);
      }

      // Stash partials for the single end-commit.
      groupResizeUpdatesRef.current.set(id, {
        id,
        areaType: activeObj?.areaType,
        width,
        height,
        ...(transformUpdate ? { transform: transformUpdate } : {}),
        ...(commitImage ? { image: commitImage } : {}),
        ...(commitFont ? { font: commitFont } : {}),
      });
    });
    // NO setState here (see onRenderGroup) — toolbar is hidden mid-gesture and
    // repositioned once on end; per-frame setState was the group-resize lag.
  }, [isDragger, activeObjects]);

  // Commit the whole gesture ONCE on end (one history:true → one Ctrl+Z reverts
  // the entire group drag / resize / rotate). Nothing was written to redux during
  // the gesture, so `present` still holds the pre-gesture state until this commit.
  const onGroupTransformEnd = useCallback(() => {
    const resizing = isGroupResizingRef.current;
    let updates;
    if (resizing) {
      updates = [...groupResizeUpdatesRef.current.values()];
    } else {
      updates = [...groupDragUpdatesRef.current.values()].map(
        ({ id, areaType, x, y, rotation }) => ({
          id,
          areaType,
          transform: rotation == null ? { x, y } : { x, y, rotation },
        })
      );
    }
    // A gesture with no movement stashed nothing → commit nothing (no dead undo step).
    if (updates.length) {
      dispatch(updateMultipleObjects({ updates, history: true }));
    }
    // Clear the live overrides AFTER the commit so each member's renderer lands on
    // the committed redux value (== the last override) with no jump.
    if (resizing) {
      activeObjects.forEach(({ id }) => clearLiveResize(id));
    }
    groupDragUpdatesRef.current.clear();
    groupResizeUpdatesRef.current.clear();
    groupBaseRotationRef.current = new Map();
    isGroupResizingRef.current = false;
    isGesturingRef.current = false;
    setIsUpdatingObject(false);
    updateMultiSelectToolbarPosition();
  }, [activeObjects, dispatch, updateMultiSelectToolbarPosition]);

  // Drag / rotate start (also handles Ctrl/Cmd-click toggle). Does NOT checkpoint
  // history — the single end-commit is the only history:true, so one Ctrl+Z reverts.
  const onGroupDragRotateStart = useCallback((e) => {
    // Ctrl/Cmd-click in group mode → toggle object selection (add or remove)
    const inputEvent = e?.inputEvent;
    if (inputEvent && (inputEvent.ctrlKey || inputEvent.metaKey)) {
      const clickedId = findObjectIdAtPoint(inputEvent.clientX, inputEvent.clientY);
      if (clickedId) {
        // Resolve areaType: check if already in selection, else look up from page layouts
        const existing = activeObjects.find((o) => o.id === clickedId);
        let areaType = existing?.areaType || "";
        if (!existing) {
          // Object not in selection — find its areaType from page layouts
          for (const layout of activePageLayouts) {
            if (!layout) continue;
            if (layout.objects?.some((o) => o.id === clickedId)) { areaType = ""; break; }
            if (layout.safeAreaObjects?.some((o) => o.id === clickedId)) { areaType = "safeArea"; break; }
          }
        }
        dispatch(setActiveObject({
          id: clickedId,
          areaType,
          isShiftPressed: true,
        }));
        if (e?.stop) e.stop();
        return;
      }
    }

    isGesturingRef.current = true;
    isGroupResizingRef.current = false;
    groupDragUpdatesRef.current.clear();
    captureGroupBaseRotations();
    setIsUpdatingObject(true);
  }, [activeObjects, activePageLayouts, dispatch, findObjectIdAtPoint, captureGroupBaseRotations]);

  // Resize start: build the per-member snapshot (baseline size / font / image so
  // content scales without drift) and flag the resize path. No history checkpoint.
  const onGroupResizeStart = useCallback(() => {
    isGesturingRef.current = true;
    isGroupResizingRef.current = true;
    groupResizeUpdatesRef.current.clear();
    captureGroupBaseRotations();
    const snapshot = {};
    activeObjects.forEach(({ id, areaType }) => {
      const arrKey = areaType === "safeArea" ? "safeAreaObjects" : "objects";
      activePageLayouts.some((layout) => {
        if (!layout) return false;
        const idx = layout[arrKey]?.findIndex((o) => o.id === id);
        if (idx === undefined || idx === -1) return false;
        const obj = layout[arrKey][idx];
        snapshot[id] = {
          type: obj?.type,
          width: Number(obj?.width) || 0,
          height: Number(obj?.height) || 0,
          fontSize: parseFloat(obj?.font?.size) || 0,
          // Full font/image objects for COMPLETE live overrides (shallow-merge renderer).
          font: obj?.font ? { ...obj.font } : null,
          imageFull: obj?.image ? { ...obj.image } : null,
          // Image crop state so we can proportionally scale during group resize
          imageScale: obj?.image?.scale ?? 1,
          imagePosX: obj?.image?.positionX ?? 0,
          imagePosY: obj?.image?.positionY ?? 0,
          imageNatW: obj?.image?.width ?? 8000,
          imageNatH: obj?.image?.height ?? 12000,
        };
        return true;
      });
    });
    groupResizeSnapshotRef.current = snapshot;
    setIsUpdatingObject(true);
  }, [activeObjects, activePageLayouts, captureGroupBaseRotations]);

  // ═══════════════════════════════════════════════════════════════════════════

  const onDrag = ({ target, left, top, moveable }) => {
    // Calculate new position considering the zoom ratio
    if (isDragger === true) {
      return;
    }
    target.style.left = `${left}px`;
    target.style.top = `${top}px`;

    // Imperative (no setState) → the drag no longer re-renders ItemDragger/Moveable
    // every frame (that per-frame `Commit` was the drag lag). Final position is
    // synced to state on onDragEnd.
    updateLabelImperative();
  };

  // After the user interacts with (moves/resizes/rotates) an object, normalize a
  // freshly-placed object's `activeObject` from the PLACEMENT shape (the full
  // object, which carries `type`) to the canvas-SELECTION shape ({ id, areaType }).
  // Why: addObjectInPage leaves activeObject as the full object (with `type`), which
  // the sidebar's replace-vs-add gate treats as "just added → next click adds/fills,
  // don't replace". A normal canvas CLICK normalizes it (setActiveObject sets the
  // no-`type` shape), but dragging a JUST-PLACED image never re-selects it (Moveable
  // is already attached), so it stays in placement shape — and a subsequent sidebar
  // click ADDS a new image instead of REPLACING. This hit optimistic/pending uploads
  // hardest (they're always freshly auto-active). Normalizing on gesture-end makes
  // "I moved/edited this image" count as "selected" → next sidebar click replaces it.
  // Only acts when activeObject has a `type` (i.e. just added/pasted) so it never
  // disturbs already-clicked selections (no `type`) or multi-select (activeObject null).
  // history:false → no extra undo step (the gesture's own commit already made one).
  const normalizeActiveSelectionAfterGesture = () => {
    if (activeObject?.type && activeObject?.id) {
      dispatch(
        setActiveObject({
          id: activeObject.id,
          areaType: activeObject.areaType || "",
          history: false,
        })
      );
    }
  };

  const onDragend = ({ target }) => {
    // setupRotationPosition();
    endGesture();
    flushOnRenderNow(); // commit the final throttled transform before the checkpoint
    dispatch(
      setCurrentObjectProperties({
        history: true,
      })
    );
    normalizeActiveSelectionAfterGesture();
    setIsUpdatingObject(false);
    updatePopoverPosition();
    updateLabelObjectPropertyPosition();
  };
  const onDragStart = () => {
    if (currentActiveObject?.locked) {
      return;
    }
    isGesturingRef.current = true;
    updatePopoverPosition();
    updateLabelObjectPropertyPosition();
    setIsUpdatingObject(true);
  };

  // Clear the gesture flag one frame after a gesture ends. Deferred (not sync) so
  // the Redux commit's resulting re-render + passive-effect flush still sees the
  // gesture as "in progress"; the lastGestureRotationRef equality guard is the
  // deterministic backstop regardless of this timing.
  const endGesture = () => {
    requestAnimationFrame(() => {
      isGesturingRef.current = false;
    });
  };

  const getActiveObjectTarget = () => resolvedSingleTarget;
  const onResizeEnd = (e) => {
    // call function to maintain history
    // setupRotationPosition();
    endGesture();
    isResizingRef.current = false;

    // ── Imperative resize commit: redux was untouched during the gesture (the
    // live geometry lived in the store). Commit the final width/height/image AND
    // the gesture transform (top/left-anchored resizes moved the wrapper via
    // onRender's cssText) in ONE history:true dispatch, then clear the override —
    // the committed redux value equals the last override, so there is no jump.
    if (isImperativeResizeRef.current) {
      const id = getActiveCanvasObjProps?.id;
      const w = resizeWorkingRef.current;
      const latest = onRenderLatestRef.current;
      if (onRenderRafRef.current != null) {
        cancelAnimationFrame(onRenderRafRef.current);
        onRenderRafRef.current = null;
      }
      onRenderLatestRef.current = null;
      if (w) {
        // Only x/y can change during a resize (top/left-anchored handles move the
        // wrapper). Rotation never changes in a resize, so keep the pre-resize
        // value — from the working ref (seeded from the LIVE object at start, so it
        // reverts on undo), NOT getActiveCanvasObjProps (preserved/stale after undo)
        // and NOT `latest` (Moveable's resize transformObject may report rotate 0,
        // which would wipe a rotated object's angle).
        const transform = latest
          ? {
            ...w.transform,
            x: latest.x,
            y: latest.y,
          }
          : undefined;
        dispatch(
          setCurrentObjectProperties({
            width: w.width,
            height: w.height,
            ...(w.image ? { image: w.image } : {}),
            ...(transform ? { transform } : {}),
            history: true,
          })
        );
      }
      clearLiveResize(id);
      resizeWorkingRef.current = null;
      isImperativeResizeRef.current = false;
      normalizeActiveSelectionAfterGesture();
      updatePopoverPosition();
      updateLabelObjectPropertyPosition();
      setIsUpdatingObject(false);
      return;
    }

    flushOnRenderNow(); // commit the final throttled transform before the checkpoint
    dispatch(
      setCurrentObjectProperties({
        history: true,
      })
    );
    normalizeActiveSelectionAfterGesture();

    updatePopoverPosition();
    updateLabelObjectPropertyPosition();
    setIsUpdatingObject(false);
  };

  const onResize = async (e) => {
    let moveX = e.dist[0];
    let moveY = e.dist[1];

    let newWidth = initialSize.width + moveX;
    let newHeight = initialSize.height + moveY;

    // ── Imperative resize (img/text/shape/sticker): push live geometry to the
    // per-object store, NO redux dispatch (so MainCanvas does not re-render). The
    // image-cover math chains off resizeWorkingRef — redux is frozen during the
    // gesture, so the working ref is the source of truth, reproducing the old
    // per-dispatch flushSync chain. Committed to redux ONCE on gesture end.
    if (isImperativeResizeRef.current && resizeWorkingRef.current) {
      const w = resizeWorkingRef.current;
      let nextImage = w.image;
      let nW = newWidth;
      let nH = newHeight;

      if (w.type === "img" && getActiveCanvasObjProps.url && w.image) {
        const baseImg = w.image;
        const imageMaxWidth =
          baseImg.width * baseImg.scale - Math.abs(baseImg.positionX);
        const imageMaxHeight =
          baseImg.height * baseImg.scale - Math.abs(baseImg.positionY);
        let scaleX = baseImg.scale || 1;
        let scaleY = baseImg.scale || 1;
        let posX = baseImg.positionX;
        let posY = baseImg.positionY;
        if (nW > imageMaxWidth) {
          if (posX < 0) {
            posX = initialImagePositionX + moveX;
            if (posX > 0) posX = 0;
          } else {
            scaleX = nW / baseImg.width;
          }
        }
        if (nH > imageMaxHeight) {
          if (posY < 0) {
            posY = initialImagePositionY + moveY;
            if (posY > 0) posY = 0;
          } else {
            scaleY = nH / baseImg.height;
          }
        }
        const isCorner =
          e.direction && e.direction[0] !== 0 && e.direction[1] !== 0;
        if (isCorner) {
          const newScale = Math.max(scaleX, scaleY);
          nextImage = {
            ...baseImg,
            scale: newScale,
            positionX: posX,
            positionY: posY,
          };
        } else {
          nextImage = { ...baseImg };
          if (moveX > 0) nextImage = { ...nextImage, scale: scaleX, positionX: posX };
          if (moveY > 0) nextImage = { ...nextImage, scale: scaleY, positionY: posY };
        }
      } else if (w.type === "text") {
        // Mirror the old text resize: never shrink the box below the text's
        // measured (wrapped) content height, and keep a sensible minimum width.
        const fontFamily = getActiveCanvasObjProps.font?.family || "Arial";
        const fontSize = parseInt(getActiveCanvasObjProps.font?.size) || 24;
        const fontWeight = getActiveCanvasObjProps.font?.weight || "normal";
        const fontStyle = getActiveCanvasObjProps.font?.style || "normal";
        const measureDiv = document.createElement("div");
        measureDiv.style.cssText = `
          position: absolute;
          visibility: hidden;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: ${fontFamily};
          font-size: ${fontSize}px;
          font-weight: ${fontWeight};
          font-style: ${fontStyle};
          line-height: 1.2;
          width: ${nW}px;
        `;
        measureDiv.textContent = getActiveCanvasObjProps.text || "";
        document.body.appendChild(measureDiv);
        const measuredHeight = measureDiv.offsetHeight;
        document.body.removeChild(measureDiv);
        if (nH < measuredHeight) nH = measuredHeight;
        if (nW < 50) nW = 50;
      }

      resizeWorkingRef.current = {
        ...w,
        width: nW,
        height: nH,
        image: nextImage,
      };
      setLiveResize(getActiveCanvasObjProps.id, {
        width: nW,
        height: nH,
        ...(nextImage ? { image: nextImage } : {}),
      });
      // NOTE: do NOT call updateLabelObjectPropertyPosition() here. It does a
      // getBoundingClientRect() which forces a SYNCHRONOUS layout right after the
      // foreignObject was resized by setLiveResize — a per-frame layout thrash
      // (worst on the first frame = the resize-start "stick"). The label snaps to
      // the final position on commit (onResizeEnd).
      return;
    }

    if (getActiveCanvasObjProps.type === "img" && getActiveCanvasObjProps.url) {
      // Ensure the clipping box does not exceed image boundaries
      const imageMaxWidth =
        getActiveCanvasObjProps.image.width *
        getActiveCanvasObjProps.image.scale -
        Math.abs(getActiveCanvasObjProps.image.positionX);
      const imageMaxHeight =
        getActiveCanvasObjProps.image.height *
        getActiveCanvasObjProps.image.scale -
        Math.abs(getActiveCanvasObjProps.image.positionY);

      let currentScale = getActiveCanvasObjProps.image.scale || 1;

      let scaleX = currentScale;
      let scaleY = currentScale;
      let currentPositionX = getActiveCanvasObjProps.image.positionX;
      let currentPositionY = getActiveCanvasObjProps.image.positionY;
      if (newWidth > imageMaxWidth) {
        // check if there position x in minux we can increase it and no need to increase scale
        if (currentPositionX < 0) {
          currentPositionX = initialImagePositionX + moveX;
          if (currentPositionX > 0) {
            currentPositionX = 0;
          }
        } else {
          scaleX = newWidth / getActiveCanvasObjProps.image.width;
        }

        //let newScale = newWidth / getActiveCanvasObjProps.image.width;
      }
      if (newHeight > imageMaxHeight) {
        // check if there position x in minux we can increase it and no need to increase scale
        if (currentPositionY < 0) {
          currentPositionY = initialImagePositionY + moveY;
          if (currentPositionY > 0) {
            currentPositionY = 0;
          }
        } else {
          scaleY = newHeight / getActiveCanvasObjProps.image.height;
        }
        //let newScale = newHeight / getActiveCanvasObjProps.image.height;
      }
      // if resizing width than use scaleX and if resizing height than use scaleY

      if (
        (e.direction && e.direction[0] === 1 && e.direction[1] === 1) ||
        (e.direction[0] === -1 && e.direction[1] === 1) ||
        (e.direction[0] === 1 && e.direction[1] === -1) ||
        (e.direction[0] === -1 && e.direction[1] === -1)
      ) {
        // when resizing from top left or top right or bottom left or bottom right
        let newScale = Math.max(scaleX, scaleY);
        dispatch(
          setCurrentObjectProperties({
            image: {
              ...getActiveCanvasObjProps.image,
              scale: newScale,
              positionX: currentPositionX,
              positionY: currentPositionY,
            },
            history: false,
          })
        );
      } else {
        // check move x or y
        if (moveX > 0) {
          // move right

          dispatch(
            setCurrentObjectProperties({
              image: {
                ...getActiveCanvasObjProps.image,
                scale: scaleX,
                positionX: currentPositionX,
              },
              history: false,
            })
          );
        }

        if (moveY > 0) {
          // move bottom
          dispatch(
            setCurrentObjectProperties({
              image: {
                ...getActiveCanvasObjProps.image,
                scale: scaleY,
                positionY: currentPositionY,
              },
              history: false,
            })
          );
        }
      }

      // when move left to right we might need to adjust the position of the image, so top to bottom
    }

    if (getActiveCanvasObjProps.type === "text") {
      // Measure text size to prevent shrinking smaller than content
      const measureDiv = document.createElement("div");
      measureDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ${getActiveCanvasObjProps.font?.family || "Arial"};
        font-size: ${parseInt(getActiveCanvasObjProps.font?.size) || 24}px;
        font-weight: ${getActiveCanvasObjProps.font?.weight || "normal"};
        font-style: ${getActiveCanvasObjProps.font?.style || "normal"};
        line-height: 1.2;
        width: ${newWidth}px;
      `;
      measureDiv.textContent = getActiveCanvasObjProps.text || "";
      document.body.appendChild(measureDiv);

      const measuredHeight = measureDiv.offsetHeight;
      const measuredWidth = measureDiv.scrollWidth;
      document.body.removeChild(measureDiv);

      // Also measure with nowrap to get minimum width
      const measureWidthDiv = document.createElement("div");
      measureWidthDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        font-family: ${getActiveCanvasObjProps.font?.family || "Arial"};
        font-size: ${parseInt(getActiveCanvasObjProps.font?.size) || 24}px;
        font-weight: ${getActiveCanvasObjProps.font?.weight || "normal"};
        font-style: ${getActiveCanvasObjProps.font?.style || "normal"};
        line-height: 1.2;
      `;
      // Get the longest line for minimum width
      const lines = (getActiveCanvasObjProps.text || "").split("\n");
      let maxLineWidth = 0;
      lines.forEach(line => {
        measureWidthDiv.textContent = line || " ";
        document.body.appendChild(measureWidthDiv);
        maxLineWidth = Math.max(maxLineWidth, measureWidthDiv.offsetWidth);
        document.body.removeChild(measureWidthDiv);
      });

      // Prevent shrinking below text size (with some padding)
      const minWidth = 50; // Minimum width regardless of text
      const minHeight = parseInt(getActiveCanvasObjProps.font?.size) * 1.2 + 10; // At least one line height

      // Don't allow resize if new size would be smaller than measured content
      if (newHeight < measuredHeight) {
        newHeight = measuredHeight;
      }
      // For width, we don't restrict since text can wrap
      if (newWidth < minWidth) {
        newWidth = minWidth;
      }
    }

    let transformUpdate = {};
    if (getActiveCanvasObjProps.type === "text" && e.drag && e.drag.beforeTranslate) {
      transformUpdate = {
        transform: {
          ...getActiveCanvasObjProps.transform,
          x: e.drag.beforeTranslate[0],
          y: e.drag.beforeTranslate[1],
        },
      };
    }

    dispatch(
      setCurrentObjectProperties({
        width: newWidth,
        height: newHeight,
        ...transformUpdate,
        history: false,
      })
    );
    updateLabelObjectPropertyPosition();
  };

  const onResizeStart = (e) => {
    if (!getActiveCanvasObjProps) return;
    isGesturingRef.current = true;
    // CRITICAL: seed the gesture from the LIVE object (read from page layouts),
    // NOT from getActiveCanvasObjProps. The undo wrapper (store.jsx) PRESERVES
    // activeObjectprops across Ctrl+Z, so after an undo it still holds the pre-undo
    // (post-resize) geometry while the actual object in `pages` has reverted.
    // Seeding from activeObjectprops made a re-resize start from the stale pre-undo
    // size (jump). The live object reverts on undo, so the next resize starts from
    // the CURRENT size. Falls back to activeObjectprops if the lookup misses.
    const liveObj =
      resolveObjFromLayouts(activeObject?.id, activeObject?.areaType) ||
      getActiveCanvasObjProps;
    if (liveObj.type === "text") {
    } else if (liveObj.type === "img") {
      setInitialImagePositionX(liveObj.image.positionX);
      setInitialImagePositionY(liveObj.image.positionY);
    }
    setInitialSize({
      width: parseFloat(liveObj.width),
      height: parseFloat(liveObj.height),
    });
    isResizingRef.current = true; // resize needs per-frame redux (size visual)
    // img/text/shape/sticker resize imperatively (no per-frame redux → no
    // MainCanvas re-render). Seed the working ref with the current geometry —
    // onResize evolves it and pushes to liveResizeStore. Other types (calendar,
    // qrcode) keep the original redux path.
    isImperativeResizeRef.current = [
      "img",
      "text",
      "shape",
      "sticker",
      "qrcode",
      "calendar",
      "multiple-calendar",
    ].includes(liveObj.type);
    if (isImperativeResizeRef.current) {
      resizeWorkingRef.current = {
        type: liveObj.type,
        width: parseFloat(liveObj.width),
        height: parseFloat(liveObj.height),
        image: liveObj.image ? { ...liveObj.image } : undefined,
        transform: { ...liveObj.transform },
      };
    }
    setIsUpdatingObject(true);
  };
  const onBeforeResize = (e) => {
    if (getActiveCanvasObjProps.type === "text") {
    }
  };

  // rAF callback: commit the latest transform from onRender to redux (once/frame).
  const flushOnRender = () => {
    onRenderRafRef.current = null;
    const latest = onRenderLatestRef.current;
    if (!latest || !getActiveCanvasObjProps) return;
    // Hard clamp: never commit a garbage angle. If a gesture ever reports an
    // out-of-range rotation (runaway able), fold it back into [0,360) so the
    // object can never become un-rotatable again. Normal values (<10 turns) are
    // committed verbatim, preserving existing behavior exactly.
    const commitRotation = isSaneRotation(latest.rotation)
      ? latest.rotation
      : normalizeRotation(latest.rotation);
    // Remember the angle this gesture is committing so the rotation-sync effect
    // (fired by the resulting Redux change) recognises it as gesture-originated
    // and does NOT re-drive Moveable's rotatable able.
    lastGestureRotationRef.current = commitRotation;
    dispatch(
      setCurrentObjectProperties({
        transform: {
          ...getActiveCanvasObjProps.transform,
          rotation: commitRotation,
          x: latest.x,
          y: latest.y,
        },
        history: false,
      })
    );
  };

  // Flush any pending throttled transform immediately (used at gesture end so the
  // final position is committed before the history checkpoint).
  const flushOnRenderNow = () => {
    if (onRenderRafRef.current != null) {
      cancelAnimationFrame(onRenderRafRef.current);
      onRenderRafRef.current = null;
    }
    flushOnRender();
    onRenderLatestRef.current = null;
  };

  const onRender = (e) => {
    if (isDragger) {
      return false;
    }
    // The rotation-sync effect is only nudging the selection box to follow an
    // external angle; the target is already rotated by React from Redux, so skip
    // the imperative transform + stash (committing them would fight the panel).
    if (isSyncingRotationRef.current) {
      return false;
    }
    // Apply the visual transform immediately (smooth), but THROTTLE the redux
    // dispatch to one per animation frame. Dispatching on every Moveable render
    // (with flushSync) re-rendered synchronously and made Moveable re-measure +
    // re-fire onRender within the same tick → "Maximum update depth exceeded"
    // while rotating, and the flood of dispatches was the rotate/drag lag.
    e.target.style.cssText += e.cssText;

    let rotation = 0;
    if (e.transformObject.rotate) {
      rotation = e.transformObject.rotate * (180 / Math.PI);
    }
    onRenderLatestRef.current = {
      rotation,
      x: e.transformObject.translate[0],
      y: e.transformObject.translate[1],
    };
    // Live ∠° readout: redux is frozen during the imperative rotate, so write the
    // angle straight to the label's DOM node and keep the label glued to the box.
    // It re-syncs to the committed value on rotate end (React re-render).
    if (isRotatingRef.current) {
      const rotEl = document.querySelector(".labelObjectRotationVal");
      if (rotEl) {
        rotEl.textContent = `∠${Math.round(((rotation % 360) + 360) % 360) % 360}°`;
      }
      updateLabelImperative();
    }
    // Drag/rotate: the cssText above already moved the element imperatively, and
    // the final transform is committed once on gesture end (flushOnRenderNow). So
    // we DON'T dispatch per frame for them — that per-frame dispatch wrote
    // state.pages and re-rendered the entire MainCanvas ~60x/sec (the lag).
    // BUT the footer/preview copies of this object read from redux, so without a
    // dispatch they'd freeze during the gesture. Mirror the move to those copies
    // imperatively (the main canvas copy is moved by the cssText above, so it's
    // skipped) → footer live-preview tracks the drag/rotate with no re-render.
    // Mirror the wrapper's translate to the footer copies for drag/rotate AND for
    // imperative resize (top/left-anchored resizes move the wrapper). The footer's
    // SIZE tracks via the preview renderers' liveResize override; this keeps its
    // POSITION in sync too. Skipped only for the non-imperative redux resize path
    // (that one updates the footer via the per-frame dispatch).
    if (!isResizingRef.current || isImperativeResizeRef.current) {
      // During an imperative resize the rotation never changes, so mirror the
      // object's actual (pre-resize) rotation — NOT the gesture's computed value,
      // which can read 0 for a rotated object being resized and would momentarily
      // un-rotate the footer thumbnail.
      const mirrorRotation = isImperativeResizeRef.current
        ? getActiveCanvasObjProps?.transform?.rotation || 0
        : rotation;
      applyLiveObjectTransform(
        getActiveCanvasObjProps?.id,
        e.transformObject.translate[0],
        e.transformObject.translate[1],
        mirrorRotation,
        e.target.ownerSVGElement
      );
    }
    // Resize: ONLY the non-imperative path (text/shape/etc.) needs the per-frame
    // redux dispatch — its size visual comes from redux width/height. For the
    // imperative image path, redux is frozen during the gesture (geometry lives in
    // the store) and the final transform is committed once in onResizeEnd, so we
    // must NOT dispatch here (that would re-render the heavy MainCanvas = the lag).
    // The wrapper's translate is already applied imperatively via the cssText above.
    if (
      isResizingRef.current &&
      !isImperativeResizeRef.current &&
      onRenderRafRef.current == null
    ) {
      onRenderRafRef.current = requestAnimationFrame(flushOnRender);
    }
  };

  //set rotation position

  // const setupRotationPosition = () => {
  //   let canvasWrapper = document.querySelector("#canvasWrapper");
  //   const canvasWrapperRect = canvasWrapper.getBoundingClientRect();

  //   const leftSpace = currentActiveObject.transform.x * zoomRatio;
  //   const rightSpace =
  //     canvasWrapperRect.width -
  //     (currentActiveObject.transform.x * zoomRatio +
  //       currentActiveObject.width * zoomRatio);
  //   const rotationAngle = currentActiveObject.transform.rotation;
  //   const normalizedAngle = ((rotationAngle % 360) + 360) % 360;
  //   if (currentActiveObject.transform.y * zoomRatio < 0) {
  //     setIsGoUp(true);
  //   }
  //   if (currentActiveObject.transform.y * zoomRatio > 0) {
  //     setIsGoUp(false);
  //   }

  //   // // set rotation position
  //   setRotationPosition("top");
  //   const rotationValues = {
  //     "left-top": "left-top",
  //     top: "top",
  //     "right-top": "right-top",
  //     left: "left",
  //     right: "right",
  //     "left-bottom": "left-bottom",
  //     bottom: "bottom",
  //     "right-bottom": "right-bottom",
  //   };
  //   if (normalizedAngle >= 46 && normalizedAngle < 136) {
  //     rotationValues["left-top"] = "bottom-left";
  //     rotationValues.top = "left";
  //     rotationValues["right-top"] = "top-left";
  //     rotationValues.left = "bottom";
  //     rotationValues.right = "top";
  //     rotationValues["left-bottom"] = "bottom-right";
  //     rotationValues.bottom = "right";
  //     rotationValues["right-bottom"] = "top-right";
  //   }

  //   if (normalizedAngle >= 136 && normalizedAngle < 226) {
  //     rotationValues["left-top"] = "right-bottom";
  //     rotationValues.top = "bottom";
  //     rotationValues["right-top"] = "left-bottom";
  //     rotationValues.left = "right";
  //     rotationValues.right = "left";
  //     rotationValues["left-bottom"] = "right-top";
  //     rotationValues.bottom = "top";
  //     rotationValues["right-bottom"] = "left-top";
  //   }

  //   if (normalizedAngle >= 226 && normalizedAngle < 316) {
  //     rotationValues["left-top"] = "top-right";
  //     rotationValues.top = "right";
  //     rotationValues["right-top"] = "bottom-right";
  //     rotationValues.left = "top";
  //     rotationValues.right = "bottom";
  //     rotationValues["left-bottom"] = "top-left";
  //     rotationValues.bottom = "left";
  //     rotationValues["right-bottom"] = "bottom-left";
  //   }

  //   if (
  //     Math.abs(currentActiveObject.transform.y * zoomRatio) >
  //     (currentActiveObject.height / 2) * zoomRatio
  //   ) {
  //     if (!isGoUp) {
  //       if (
  //         currentActiveObject.transform.x * zoomRatio >
  //         (currentActiveObject.width / 2) * zoomRatio
  //       ) {
  //         setRotationPosition(rotationValues["left-top"]);
  //       } else if (
  //         Math.abs(currentActiveObject.transform.x * zoomRatio) >
  //         (currentActiveObject.width / 2) * zoomRatio
  //       ) {
  //         setRotationPosition(rotationValues["right-top"]);
  //       } else {
  //         setRotationPosition(rotationValues["top"]);
  //       }
  //     } else if (rightSpace > leftSpace) {
  //       setRotationPosition(
  //         rotationValues[`right-${isGoUp ? "bottom" : "top"}`]
  //       );
  //     } else if (leftSpace > rightSpace) {
  //       setRotationPosition(
  //         rotationValues[`left-${isGoUp ? "bottom" : "top"}`]
  //       );
  //     }
  //   } else if (currentActiveObject.transform.y * zoomRatio < 50) {
  //     if (!isGoUp) {
  //       if (
  //         currentActiveObject.transform.x * zoomRatio >
  //         (currentActiveObject.width / 2) * zoomRatio
  //       ) {
  //         setRotationPosition(rotationValues["left-top"]);
  //       } else if (
  //         Math.abs(currentActiveObject.transform.x * zoomRatio) >
  //         (currentActiveObject.width / 2) * zoomRatio
  //       ) {
  //         setRotationPosition(rotationValues["right-top"]);
  //       } else {
  //         setRotationPosition(rotationValues["top"]);
  //       }
  //     } else if (rightSpace > leftSpace) {
  //       setRotationPosition(rotationValues["right"]);
  //     } else if (leftSpace > rightSpace) {
  //       setRotationPosition(rotationValues["left"]);
  //     } else if (rightSpace === leftSpace) {
  //       setRotationPosition(rotationValues["top"]);
  //     }
  //   } else if (
  //     currentActiveObject.transform.y * zoomRatio +
  //       currentActiveObject.height * zoomRatio >
  //     canvasWrapperRect.height
  //   ) {
  //     if (!isGoUp) {
  //       if (
  //         currentActiveObject.transform.x * zoomRatio >
  //         (currentActiveObject.width / 2) * zoomRatio
  //       ) {
  //         setRotationPosition(rotationValues["left-top"]);
  //       } else if (
  //         Math.abs(currentActiveObject.transform.x * zoomRatio) >
  //         (currentActiveObject.width / 2) * zoomRatio
  //       ) {
  //         setRotationPosition(rotationValues["right-top"]);
  //       } else {
  //         setRotationPosition(rotationValues["top"]);
  //       }
  //     } else if (rightSpace > leftSpace) {
  //       setRotationPosition(rotationValues["right-top"]);
  //     } else if (leftSpace > rightSpace) {
  //       setRotationPosition(rotationValues["left-top"]);
  //     } else if (rightSpace === leftSpace) {
  //       setRotationPosition(rotationValues["top"]);
  //     }
  //   }
  // };

  // set adjustable
  useEffect(() => {
    //  check user type is customer
    if (userObj?.userTypeCode === USER_TYPES.CUSTOMER) {
      // check current active object is disabled for client
      if (currentActiveObject?.disabledForClient) {
        setIsAdjustable(false);
      } else if (currentActiveObject?.locked) {
        setIsAdjustable(false);
      } else {
        setIsAdjustable(true);
      }
    } else if (currentActiveObject?.locked) {
      setIsAdjustable(false);
    } else {
      setIsAdjustable(true);
    }
  }, [currentActiveObject]);

  return (
    <>
      {/* ── Single-object Moveable ─────────────────────────────────────────── */}
      {/* Only active when exactly 0 or 1 object is selected (isMultiSelect = false). */}
      {!isMultiSelect && resolvedSingleTarget && document.body.contains(resolvedSingleTarget) && (
        <Moveable
          ref={moveableRef}
          zoom={moveableZoom}
          target={resolvedSingleTarget}
          draggable={isAdjustable}
          triggerAblesSimultaneously={true}
          rotatable={isAdjustable}
          resizable={isAdjustable}
          scalable={isAdjustable}
          svgOrigin="50% 50%"
          edge={false}
          origin={false}
          throttleResize={0}
          throttleRotate={0}
          rotationPosition={["left-top", "top", "bottom", "right-bottom"]}
          className="moveable-rotation-control"
          onDragStart={() => onDragStart()}
          onDrag={onDrag}
          onDragEnd={onDragend}
          onRotateStart={(e) => {
            // Sync-driven (Position-panel) rotate: don't enter gesture mode — it's
            // a box-only visual update, not a user gesture, and must not commit.
            if (isSyncingRotationRef.current) return;
            isGesturingRef.current = true;
            isRotatingRef.current = true;
            setIsUpdatingObject(true);
          }}
          onRotateEnd={(e) => {
            // Sync-driven rotate ends here too (instant request fires the full
            // cycle). Skip the commit/history/normalize so the panel's exact value
            // is preserved — the box already followed via Moveable's own render.
            if (isSyncingRotationRef.current) return;
            // call function to maintain history
            // setupRotationPosition();
            endGesture();
            isRotatingRef.current = false;
            flushOnRenderNow(); // commit the final throttled rotation before the checkpoint

            dispatch(
              setCurrentObjectProperties({
                history: true,
              })
            );
            normalizeActiveSelectionAfterGesture();
            setIsUpdatingObject(false);
          }}
          onResize={onResize}
          onBeforeResize={onBeforeResize}
          onResizeStart={onResizeStart}
          onResizeEnd={onResizeEnd}
          onRender={onRender}
          snappable={true}
          snapThreshold={1}
          snapRenderThreshold={1}
          // Snap-distance digit display OFF: Moveable sizes the digit TEXT as
          // fontSize × zoom, and our inverse `zoom` prop (needed to keep the 1px
          // control lines crisp under the canvas-box transform) blows the digits
          // up huge when zoomed out. Snapping/guidelines still work — only the
          // numeric labels are hidden.
          isDisplaySnapDigit={false}
          isDisplayInnerSnapDigit={false}
          snapGap={true}
          snapDirections={{
            top: true,
            right: true,
            bottom: true,
            left: true,
            center: true,
            middle: true,
          }}
          elementSnapDirections={{
            top: true,
            left: true,
            bottom: true,
            right: true,
            center: true,
            middle: true,
          }}
          snapDigit={0}
          flushSync={flushSync}
          isDisplayGridGuidelines={true}
          elementGuidelines={elementGuidelines}
        />
      )}

      {/* ── Multi-object Moveable ─────────────────────────────────────────── */}
      {/* Rendered only when 2+ objects are selected; handles group transforms. */}
      {isMultiSelect && multiTargets.length > 1 && (
        <Moveable
          ref={groupMoveableRef}
          zoom={moveableZoom}
          target={multiTargets}
          draggable={true}
          rotatable={true}
          resizable={true}
          keepRatio={false}
          origin={false}
          edge={false}
          throttleResize={0}
          throttleRotate={0}
          // PERF TEST: snapping OFF on the group. Snap recomputes against all
          // elementGuidelines for all N members every (synchronous, flushSync) frame
          // — the suspected cause of the stuck-move-stuck stutter. Rendering the boxes
          // is cheap; the snap geometry is what spikes. If this is smooth, snapping
          // was the cost and groups simply don't snap-to-guides (single object still does).
          snappable={false}
          snapThreshold={1}
          // see single-object Moveable: digits balloon under the inverse zoom prop.
          isDisplaySnapDigit={false}
          isDisplayInnerSnapDigit={false}
          snapGap={true}
          snapDirections={{ top: true, right: true, bottom: true, left: true, center: true, middle: true }}
          elementSnapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
          snapDigit={0}
          // PERF: keep flushSync (the blue control-box must track rotate/drag LIVE —
          // without it Moveable commits its box asynchronously and it visibly trails).
          // The group-drag lag was NOT flushSync itself — it was
          // `triggerAblesSimultaneously` (removed above), which made Moveable compute
          // drag+resize+rotate geometry for ALL N targets every frame. With only the
          // active able computing, the synchronous flushSync render is cheap enough to
          // stay smooth. (my onRenderGroup callback is ~0.1ms and MainCanvas doesn't
          // re-render, so the remaining cost is purely Moveable's own group render.)
          // Show react-moveable's real per-child selection lines AT REST (so you can
          // see exactly which objects are selected), but hide them DURING a gesture —
          // re-rendering N child boxes synchronously at ~200Hz (flushSync) is the
          // group-stutter. While gesturing (isUpdatingObject) only the single group box
          // renders, which flushSync keeps live and is cheap; the child lines snap back
          // on release. (snapping stays off — its per-frame geometry was the other
          // spike; single-object still snaps.)
          hideChildMoveableDefaultLines={isUpdatingObject}
          flushSync={flushSync}
          elementGuidelines={elementGuidelines}
          // Four rotate handles (match the single-object Moveable) instead of the
          // default single top handle.
          rotationPosition={["left-top", "top", "bottom", "right-bottom"]}
          className="moveable-rotation-control"
          // Drag/rotate live sync (imperative + footer mirror, no per-frame dispatch)
          onRenderGroup={onRenderGroup}
          // Resize: per-member liveResize + position, no per-frame dispatch
          onResizeGroup={onResizeGroup}
          // Lifecycle — split start (drag/rotate vs resize), single commit on end.
          // The start wrappers set the flushSync mode BEFORE the first frame: drag =
          // off (smooth), rotate/resize = on (box tracks live).
          onDragGroupStart={onGroupDragRotateStart}
          onDragGroupEnd={onGroupTransformEnd}
          onResizeGroupStart={onGroupResizeStart}
          onResizeGroupEnd={onGroupTransformEnd}
          onRotateGroupStart={onGroupDragRotateStart}
          onRotateGroupEnd={onGroupTransformEnd}
        />
      )}

      {/* ── Multi-select floating toolbar ─────────────────────────────────── */}
      {isMultiSelect &&
        createPortal(
          <MultiSelectToolbar
            activeObjects={activeObjects}
            style={{
              top: `${multiSelectToolbarPos.top}px`,
              left: `${multiSelectToolbarPos.left}px`,
              visibility: !isUpdatingObject ? "visible" : "hidden",
            }}
          />,
          document.body
        )}

      {!isDragger &&
        getActiveCanvasObjProps &&
        createPortal(
          <ObjectProperty
            style={{
              left: `${labelObjectPropertyPosition.left}px`,
              top: `${labelObjectPropertyPosition.top}px`,
            }}
            objectWidth={getActiveCanvasObjProps.width}
            objectHeight={getActiveCanvasObjProps.height}
            objectRotation={getActiveCanvasObjProps.transform?.rotation}
          />,
          document.body
        )}

      {/* Image popover hidden — replaced by ImageFloatingToolbar in layout toolbar slot */}
      {/* {!isDragger &&
        getActiveCanvasObjProps &&
        getActiveCanvasObjProps?.type === "img" &&
        !getActiveCanvasObjProps?.isProcessing &&
        activeObject?.target && document.body.contains(activeObject.target)
        &&
        createPortal(
          <ImageSettings
            style={{
              left: `${popoverPosition.left}px`,
              top: `${popoverPosition.top}px`,
              visibility: !isUpdatingObject ? "visible" : "hidden",
            }}
            onChanges={() => {
              updatePopoverPosition();
            }}
          />,
          document.body
        )} */}

      {/* Sticker popover replaced by StickerFloatingToolbar in layout toolbar slot */}
      {/* Shape popover replaced by ShapeFloatingToolbar in layout toolbar slot */}
    </>
  );
};

export default ItemDragger;
