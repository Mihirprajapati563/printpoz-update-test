import HTMLFlipBook from "react-pageflip";
import { useEffect, useState } from "react";
import {
  BodyText,
  Box,
  FlexBox,
  PhotoModalBody,
  PhotoModalHeader,
  PhotoModalStyled,
  FlipBookContainer,
  FlipBookPages,
  PhotoModalBodyStyled,
  PrimaryButton,
  LightPrimaryButton,
} from "../../common-components/StyledComponents.jsx";
import { useDispatch, useSelector } from "react-redux";
import {
  getActiveEditorType,
  getCanvasSize,
  getSettings,
} from "../../library/utils/helpers/index.js";
import { EDITOR_TYPES } from "../../library/utils/constants/index.js";
import { EDITOR_SUB_TYPES } from "../../library/utils/constants/index.js";
import { Container, Row, Col, Form, Button } from "react-bootstrap"; // Import Bootstrap components
import {
  setCanvasSize,
  setEditorType,
  resetEditor,
  setSettings,
  setDepth,
} from "../../store/slices/canvas.js";
import { AiOutlineClose } from "react-icons/ai";
import { resetThemeDetails } from "../../store/slices/projectSetup.js";
export const EditorSettings = ({ show, handleClose }) => {
  const activeEditorType = useSelector(getActiveEditorType);
  const canvasSize = useSelector(getCanvasSize);
  const dispatch = useDispatch();
  const [displaySize, setDisplaySize] = useState({
    width: 0,
    height: 0,
    depth: 0,
  }); // depth used in canvas size
  const [displayDepth, setDisplayDepth] = useState(false);
  const [selectedEditorType, setSelectedEditorType] = useState("");
  const sizesCount = useSelector(
    (state) => state.projectSetup.allThemes?.length ?? 0
  );
  const editor_settings = useSelector(getSettings);
  const [selectedEditorSubType, setSelectedEditorSubType] = useState(
    editor_settings.subtype
  );
  useEffect(() => {
    setSelectedEditorSubType(editor_settings.subtype);
    if (activeEditorType === EDITOR_TYPES.CANVAS) {
      setDisplayDepth(true);
    }
  }, [editor_settings]);
  const handleEditorTypeChange = (e) => {
    setSelectedEditorType(e.target.value);
    if (e.target.value === EDITOR_TYPES.CANVAS) {
      setDisplayDepth(true);
    } else {
      setDisplaySize({
        ...displaySize,
        depth: 0,
      });
      setDisplayDepth(false);
    }
  };

  const handleEditorSubTypeChange = (e) => {
    setSelectedEditorSubType(e.target.value);
  };
  // Function to handle input change for width and height
  useEffect(() => {
    let depth = 0;
    if (canvasSize.depth) {
      depth = canvasSize.depth;
    }
    setDisplaySize({
      width: canvasSize.width - depth * 2,
      height: canvasSize.height - depth * 2,
      depth: depth,
    });
    setSelectedEditorType(activeEditorType);
  }, [canvasSize]);
  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setDisplaySize({
      ...displaySize,
      [id]: value,
    });
  };
  const saveSize = () => {
    //validate width and height not null
    if (
      displaySize.width === null ||
      displaySize.height === null ||
      displaySize.width <= 0 ||
      displaySize.height <= 0
    ) {
      alert("Width and Height should be greater than 0");
      return;
    }
    if (
      selectedEditorType.toString().toLowerCase() === "canvas" &&
      (displaySize.depth === null || displaySize.depth === undefined)
    ) {
      alert("Depth should be greater than 0"); // thickness of canvas
    }
    // if depth is not provided, set it to 0
    if (displaySize.depth === null || displaySize.depth === undefined) {
      displaySize.depth = 0;
    }
    dispatch(
      setCanvasSize({
        ...canvasSize,
        width:
          parseFloat(displaySize.width) + parseFloat(displaySize.depth) * 2,
        height:
          parseFloat(displaySize.height) + parseFloat(displaySize.depth) * 2,
        depth: parseFloat(displaySize.depth),
      })
    );
    dispatch(setEditorType(selectedEditorType.toString().toLowerCase()));
    dispatch(setSettings({ subtype: selectedEditorSubType }));
    dispatch(resetThemeDetails());
    dispatch(resetEditor());

    // close popup
    handleClose();
  };

  const updateSize = () => {
    //validate width and height not null
    // if (displaySize.width === null || displaySize.height === null || displaySize.width <= 0 || displaySize.height <= 0) {
    //     alert("Width and Height should be greater than 0");
    //     return;
    // }
    // if (selectedEditorType.toString().toLowerCase() === 'canvas' && (displaySize.depth === null || displaySize.depth === undefined)) {
    //     alert("Depth should be greater than 0"); // thickness of canvas
    // }
    // // if depth is not provided, set it to 0
    // if (displaySize.depth === null || displaySize.depth === undefined) {
    //     displaySize.depth = 0;
    // }
    //  dispatch(setCanvasSize({ width: parseFloat(displaySize.width) + parseFloat(displaySize.depth), height: parseFloat(displaySize.height) + parseFloat(displaySize.depth), depth: parseFloat(displaySize.depth) }));
    dispatch(setEditorType(selectedEditorType.toString().toLowerCase()));
    dispatch(setSettings({ subtype: selectedEditorSubType }));

    dispatch(setDepth({ depth: parseFloat(displaySize.depth) }));
    // close popup
    handleClose();
  };

  return (
    <PhotoModalStyled
      dialogClassName="mob_full_screen_modal"
      show={show}
      onHide={handleClose}
      size="xl"
      backdrop="static"
    >
      <PhotoModalHeader>
        <FlexBox
          className="cursor-pointer mob_heading_flex"
          grow={1}
          justify="center"
        >
          <BodyText
            fontsize="20px"
            fontweight="600"
            className="mob_text_flex"
            textcolor={`var(--primary)`}
            ml="80px"
          >
            Editor Settings
          </BodyText>
        </FlexBox>
        {/* Add the close icon */}
        <FlexBox
          className="cursor-pointer"
          justify="flex-end"
          onClick={handleClose}
          style={{ marginRight: "20px" }}
        >
          <AiOutlineClose size={24} color="#000" />
        </FlexBox>
      </PhotoModalHeader>

      <PhotoModalBodyStyled>
        {/* lets create for take canvas size in pixel and when save , lets apply to canvas size.  create form with input */}
        <Container>
          <Row className="mb-3">
            <Col>
              <h5 className="font-weight-bold theme-bg-color-text">Canvas Size</h5>
            </Col>
          </Row>
          <Row className="mb-3">
            <Col md={5} className="mb-3">
              <Form.Group controlId="width">
                <Form.Label className="font-weight-bold text-dark">
                  Width
                </Form.Label>
                <Form.Control
                  type="number"
                  value={displaySize.width}
                  onChange={handleInputChange}
                />
              </Form.Group>
            </Col>
            <Col md={5}>
              <Form.Group controlId="height">
                <Form.Label className="font-weight-bold text-dark">
                  Height
                </Form.Label>
                <Form.Control
                  type="number"
                  value={displaySize.height}
                  onChange={handleInputChange}
                />
              </Form.Group>
            </Col>
          </Row>

          {/* Lets create new row and add dropdown to select editor type */}

          <Row className="mb-3">
            <Col md={5}>
              <Form.Group controlId="editorType">
                <Form.Label className="font-weight-bold text-dark">
                  Editor
                </Form.Label>
                <Form.Control
                  as="select"
                  value={selectedEditorType}
                  onChange={handleEditorTypeChange} // Enable selection change
                >
                  {/* Dynamically generate options */}
                  {Object.keys(EDITOR_TYPES).map((key) => (
                    <option key={key} value={EDITOR_TYPES[key]}>
                      {EDITOR_TYPES[key].charAt(0).toUpperCase() +
                        EDITOR_TYPES[key].slice(1)}
                    </option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
            {/* if editor type is calendar than lets display its sub type to select */}
            {selectedEditorType === EDITOR_TYPES.CALENDER && (
              <Col md={5}>
                <Form.Group controlId="editorSubType">
                  <Form.Label className="font-weight-bold text-dark">
                    Calendar Type
                  </Form.Label>
                  <Form.Control
                    as="select"
                    value={selectedEditorSubType}
                    onChange={handleEditorSubTypeChange} // Enable selection change
                  >
                    {/* Dynamically generate options */}
                    {Object.keys(EDITOR_SUB_TYPES.CALENDER).map((key) => (
                      <option key={key} value={EDITOR_SUB_TYPES.CALENDER[key]}>
                        {EDITOR_SUB_TYPES.CALENDER[key].toUpperCase()}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              </Col>
            )}

            {/* if editor type is acrylic than lets display its sub type to select */}
            {selectedEditorType === EDITOR_TYPES.ACRYLIC && (
              <Col md={5}>
                <Form.Group controlId="editorSubType">
                  <Form.Label className="font-weight-bold text-dark">
                    Acrylic Type
                  </Form.Label>
                  <Form.Control
                    as="select"
                    value={selectedEditorSubType}
                    onChange={handleEditorSubTypeChange} // Enable selection change
                  >
                    {/* Dynamically generate options */}
                    {Object.keys(EDITOR_SUB_TYPES.ACRYLIC).map((key) => (
                      <option key={key} value={EDITOR_SUB_TYPES.ACRYLIC[key]}>
                        {EDITOR_SUB_TYPES.ACRYLIC[key].toUpperCase()}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              </Col>
            )}

            {/* if editor type is custome product than lets display its sub type to select */}
            {selectedEditorType === EDITOR_TYPES.CUSTOME_PRODUCT && (
              <Col md={5}>
                <Form.Group controlId="editorSubType">
                  <Form.Label className="font-weight-bold text-dark">
                    Custom Product Type
                  </Form.Label>
                  <Form.Control
                    as="select"
                    value={selectedEditorSubType}
                    onChange={handleEditorSubTypeChange} // Enable selection change
                  >
                    {/* Dynamically generate options */}
                    {Object.keys(EDITOR_SUB_TYPES.CUSTOME_PRODUCT).map((key) => (
                      <option key={key} value={EDITOR_SUB_TYPES.CUSTOME_PRODUCT[key]}>
                        {EDITOR_SUB_TYPES.CUSTOME_PRODUCT[key].toUpperCase()}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              </Col>
            )}

            {/* if editor type is greeting card than lets display its sub type to select */}
            {selectedEditorType === EDITOR_TYPES.GREETING_CARD && (
              <Col md={5}>
                <Form.Group controlId="editorSubType">
                  <Form.Label className="font-weight-bold text-dark">
                    Greeting Card Type
                  </Form.Label>
                  <Form.Control
                    as="select"
                    value={selectedEditorSubType}
                    onChange={handleEditorSubTypeChange} // Enable selection change
                  >
                    {/* Dynamically generate options */}
                    {Object.keys(EDITOR_SUB_TYPES.GREETING_CARD).map((key) => (
                      <option key={key} value={EDITOR_SUB_TYPES.GREETING_CARD[key]}>
                        {EDITOR_SUB_TYPES.GREETING_CARD[key].toUpperCase()}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              </Col>
            )}

            {/* if editor type is photo book than lets display its sub type to select */}
            {selectedEditorType === EDITOR_TYPES.PHOTOBOOK && (
              <Col md={5}>
                <Form.Group controlId="editorSubType">
                  <Form.Label className="font-weight-bold text-dark">
                    Photo Book Type
                  </Form.Label>
                  <Form.Control
                    as="select"
                    value={selectedEditorSubType}
                    onChange={handleEditorSubTypeChange}
                  >
                    <option value="">Select Photo Book Type</option>
                    {Object.keys(EDITOR_SUB_TYPES.PHOTOBOOK).map((key) => (
                      <option key={key} value={EDITOR_SUB_TYPES.PHOTOBOOK[key]}>
                        {EDITOR_SUB_TYPES.PHOTOBOOK[key].toUpperCase()}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              </Col>
            )}

            {selectedEditorType === EDITOR_TYPES.LAYFLATALBUM && (
              <Col md={5}>
                <Form.Group controlId="editorSubType">
                  <Form.Label className="font-weight-bold text-dark">
                    Layflat Album Type
                  </Form.Label>
                  <Form.Control
                    as="select"
                    value={selectedEditorSubType}
                    onChange={handleEditorSubTypeChange}
                  >
                    <option value="">Default</option>
                    {Object.keys(EDITOR_SUB_TYPES.LAYFLATALBUM).map((key) => (
                      <option key={key} value={EDITOR_SUB_TYPES.LAYFLATALBUM[key]}>
                        {EDITOR_SUB_TYPES.LAYFLATALBUM[key].toUpperCase()}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              </Col>
            )}

            {/* if editor  sub type is wooden calendar than display browse  */}
            {displayDepth && (
              <Col md={5}>
                <Form.Group controlId="depth">
                  <Form.Label className="font-weight-bold text-dark">
                    Depth (thickness)
                  </Form.Label>
                  <Form.Control
                    type="number"
                    value={displaySize.depth}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
            )}
          </Row>

          {/* Display the selected editor type (optional) */}
          <Row className="mt-3">
            <Col className="col-auto">
              <PrimaryButton
                variant="primary"
                onClick={saveSize}
                style={{ marginLeft: "0px" }}
              >
                Save & Reset
              </PrimaryButton>
            </Col>
            
            {sizesCount <= 1 && (
            <Col className="col-auto">
              <LightPrimaryButton
                variant="secondary"
                onClick={updateSize}

              >
                Update
              </LightPrimaryButton>
              {/* Update will only update editor type and subtype, lets add note */}
            </Col>
            )}
          </Row>
          <BodyText
            fontsize="12px"
            fontweight="600"
            className="mob_text_flex"
            textcolor={`var(--primary)`}
            mt="20px"

          >
            Note: Update will only update editor type and subtype and depth.
          </BodyText>
        </Container>
      </PhotoModalBodyStyled>
    </PhotoModalStyled>
  );
};
