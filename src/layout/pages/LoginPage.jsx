import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { setAuthItems } from "../../store/slices/projectSetup";
import { setUserDetails } from "../../store/slices/projectSetup";
import styled, { keyframes } from "styled-components";
import {
  FaEnvelope,
  FaLock,
  FaRegUserCircle,
  FaTimes,
  FaBook,
  FaBookOpen,
  FaRegCalendarAlt,
  FaPalette,
  FaLayerGroup,
  FaImages,
  FaRegImage,
  FaRegImages,
  FaFilm,
  FaMagnet,
  FaRegAddressCard,
  FaRegEnvelope,
  FaIdCard,
  FaGift,
  FaTshirt,
  FaChevronDown,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import CryptoJS from "crypto-js";
import { useNavigate } from "react-router-dom";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { apiPost } from "../../library/utils/common-services/apiCall";
import { LOGIN_CRYPTO_KEY, EDITOR_CATEGORIES } from "../../library/utils/constants";
import { isDesktop } from "../../desktop/index";
import {
  clearLastOpenEditor,
  setStoredUser,
  rememberCredential,
  getRememberedEmails,
  getRememberedPassword,
  removeRememberedEmail,
} from "../../library/utils/helpers/session";
import { clearEditorSnapshot } from "../../library/utils/helpers/editorSnapshot";

const decryptLoginResponse = (encryptedStr) => {
  const decrypted = CryptoJS.AES.decrypt(
    encryptedStr,
    LOGIN_CRYPTO_KEY,
  ).toString(CryptoJS.enc.Utf8);
  return JSON.parse(decrypted);
};

/* ---------------- Editor-type showcase (every implemented category) ----------------
 * Built from EDITOR_CATEGORIES (the same source of truth the post-login design
 * selection screen uses) so the marquee always reflects ALL editor types the app
 * implements. Each category is paired with a bundled photo + a product frame style;
 * the category's own icon (mirrors CategoryGrid's CATEGORY_ICONS) rides on the card. */
const ICON_MAP = {
  photobook: FaBook,
  layflatalbum: FaBookOpen,
  calendar: FaRegCalendarAlt,
  canvas: FaPalette,
  acrylic: FaLayerGroup,
  wallart: FaImages,
  photoframe: FaRegImage,
  print: FaRegImages,
  photostrip: FaFilm,
  photomagnet: FaMagnet,
  card: FaRegAddressCard,
  greetingcard: FaRegEnvelope,
  visitingcard: FaIdCard,
  giftcard: FaGift,
  custom_product: FaTshirt,
};
const STYLE_MAP = {
  // Photobook ships MANY mockups → each `src` becomes its own marquee card.
  photobook: {
    kind: "book",
    srcs: [
      "/images/photos/photobook.jpg",
      "/images/photos/photobook_1.jpeg",
      "/images/photos/photobook_2.jpeg",
      "/images/photos/photobook_3.jpeg",
      "/images/photos/photobook_4.jpeg",
      "/images/photos/photobook_5.jpeg",
      "/images/photos/photobook_6.jpeg",
      "/images/photos/photobook_7.jpeg",
      "/images/photos/photobook_8.jpeg",
      "/images/photos/photobook_9.jpeg",
      "/images/photos/photobook_10.jpeg",
      "/images/photos/photobook_11.jpeg",
      "/images/photos/photobook_12.jpeg",
      "/images/photos/photobook_13.jpeg",
      "/images/photos/photobook_14.jpeg",
      "/images/photos/photobook_15.jpeg",
    ],
  },
  layflatalbum: { kind: "book", src: "/images/photos/layflat_album.jpeg" },
  calendar: { kind: "calendar", src: "/images/photos/calendar.jpg" },
  canvas: { kind: "canvas", src: "/images/photos/canvas-print.jpg" },
  acrylic: { kind: "acrylic", src: "/images/photos/acrylic.jpg" },
  wallart: { kind: "frame", src: "/images/photos/printted_wall_art.webp" },
  photoframe: { kind: "frame", src: "/images/photos/photoframe.webp" },
  print: { kind: "print", src: "/images/photos/photo-prints.webp" },
  photostrip: { kind: "strip", src: "/images/photos/photostrip.jpg" },
  photomagnet: { kind: "magnet", src: "/images/photos/photomanget.jpeg" },
  card: { kind: "card", src: "/images/photos/cards.webp" },
  greetingcard: { kind: "card", src: "/images/photos/greetingcard.webp" },
  visitingcard: { kind: "print", src: "/images/photos/visitingcard.jpg" },
  giftcard: { kind: "card", src: "/images/photos/giftcard.jpg" },
  custom_product: { kind: "print", src: "/images/photos/custome_products.webp" },
};
const DEFAULT_STYLE = { kind: "print", src: "/images/photos/photo_1.webp" };
// Expand each editor category into marquee card(s). A category with multiple mockups
// (photobook — via STYLE_MAP.*.srcs) contributes ONE separate card per image; every
// other category is a single card. The two groups are then proportionally interleaved
// so the many photobook cards spread evenly through the marquee instead of clustering.
const makeCard = (c, src) => ({
  label: c.label,
  Icon: ICON_MAP[c.icon] || FaRegImage,
  kind: (STYLE_MAP[c.icon] || DEFAULT_STYLE).kind,
  src,
});
const MULTI_CARDS = EDITOR_CATEGORIES.flatMap((c) => {
  const style = STYLE_MAP[c.icon] || DEFAULT_STYLE;
  return style.srcs ? style.srcs.map((src) => makeCard(c, src)) : [];
});
const SINGLE_CARDS = EDITOR_CATEGORIES.flatMap((c) => {
  const style = STYLE_MAP[c.icon] || DEFAULT_STYLE;
  return style.srcs ? [] : [makeCard(c, style.src)];
});
const SHOWCASE = [];
{
  let mi = 0;
  let si = 0;
  const mLen = MULTI_CARDS.length;
  const sLen = SINGLE_CARDS.length;
  while (mi < mLen || si < sLen) {
    const takeMulti =
      si >= sLen || (mi < mLen && (sLen === 0 || mi / mLen <= si / sLen));
    if (takeMulti) SHOWCASE.push(MULTI_CARDS[mi++]);
    else SHOWCASE.push(SINGLE_CARDS[si++]);
  }
}
const STRIP_SRCS = [
  "/images/photos/photo_1.webp",
  "/images/photos/photo_3.webp",
  "/images/photos/photo_5.webp",
];
// Five full-height columns; the showcase cards are dealt round-robin across them so
// each column holds an even slice (works for any card count), repeated so the vertical
// loop never gaps. Alternating directions + varied speeds keep it lively.
const COLUMN_DURATIONS = [78, 64, 88, 72, 82];
const COLUMNS = COLUMN_DURATIONS.map((dur, ci) => ({
  dur,
  items: SHOWCASE.map((_, i) => i).filter((i) => i % COLUMN_DURATIONS.length === ci),
}));
const COL_REPEAT = 4; // even → -50% loop stays seamless; 4×~6 cards fills each column

/* Shared focus accent — sourced from the app's brand token (`--primary`) so the
 * login tracks the same primary as the rest of the editor; falls back to the
 * default steel-blue when the token is unset (e.g. before a brand theme loads).
 * `accent(pct)` yields a translucent variant straight from the token via color-mix
 * for focus rings / glows. */
const ACCENT = "var(--primary, #4084b5)";
const accent = (pct) => `color-mix(in srgb, ${ACCENT} ${pct}, transparent)`;

/* ---------------- Animations ---------------- */
const rise = keyframes`from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; }`;
const scrollY = keyframes`from { transform: translateY(0); } to { transform: translateY(-50%); }`;
const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const popIn = keyframes`from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: none; }`;
const spin = keyframes`to { transform: rotate(360deg); }`;

/* ---------------- Layout ---------------- */
const Page = styled.div`
  position: relative;
  min-height: 100vh;
  display: flex;
  overflow: hidden;
  isolation: isolate;
  background: #000000;
  color: #ffffff;
  /* Match the app's typeface (Roboto is loaded globally) so the first screen is
   * visually consistent with every screen after login. */
  font-family: "Roboto", "Helvetica Neue", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
`;

/* Full-page marquee of every editor type — sits behind the overlay + card */
const Marquee = styled.div`
  position: absolute;
  top: -40vh;
  left: -40vw;
  width: 180vw;
  height: 180vh;
  z-index: 0;
  display: flex;
  justify-content: center;
  gap: 18px;
  transform: rotate(-20deg);
`;

const Col = styled.div`
  overflow: hidden;
  width: calc((100vw - 20px - 72px) / 5);

  @media (max-width: 1180px) {
    width: calc((100vw - 20px - 54px) / 4);
    &:nth-child(5) {
      display: none;
    }
  }
  @media (max-width: 720px) {
    width: calc((100vw - 20px - 36px) / 3);
    &:nth-child(4) {
      display: none;
    }
  }
`;

const Track = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-top: 18px;
  animation: ${scrollY} ${(p) => p.$dur}s linear infinite;
  animation-direction: ${(p) => (p.$reverse ? "reverse" : "normal")};
  will-change: transform;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/* Netflix-style overlay — a light, even tint that lets the marquee show through,
 * with the darkening pushed to the top/bottom edges (vignette) rather than a heavy
 * flat black. A gentle radial vignette rounds off the corners. Readability of the
 * left copy is handled by a localized scrim on <Showcase> instead of a dark page. */
const Overlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(7deg, rgba(0, 0, 0, 0.8500) 10.00%, rgba(0, 0, 0, 0.8465) 17.25%, rgba(0, 0, 0, 0.8361) 24.50%, rgba(0, 0, 0, 0.8187) 31.75%, rgba(0, 0, 0, 0.7944) 39.00%, rgba(0, 0, 0, 0.7632) 46.25%, rgba(0, 0, 0, 0.7250) 53.50%, rgba(0, 0, 0, 0.6868) 60.75%, rgba(0, 0, 0, 0.6556) 68.00%, rgba(0, 0, 0, 0.6312) 75.25%, rgba(0, 0, 0, 0.6139) 82.50%, rgba(0, 0, 0, 0.6035) 89.75%, rgba(0, 0, 0, 0.6000) 97.00%)
`;

const Grain = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.4;
  background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 3px 3px;
`;

/* ---------------- Product card (marquee tile) ---------------- */
const ProductBox = styled.div`
  position: relative;
  flex: none;
  border-radius: 12px;
  overflow: hidden;
  background: #151515;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.7);
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.32s ease,
    border-color 0.32s ease;

  /* Focus highlight — on hover the tile lifts, gains an accent glow ring, and its
   * photo drops the grayscale so it "comes alive" to signal focus. */
  &:hover {
    transform: translateY(-5px) scale(1.02);
    border-color: ${accent("70%")};
    box-shadow: 0 20px 44px rgba(0, 0, 0, 0.8), 0 0 0 1px ${accent("55%")},
      0 8px 30px ${accent("40%")};
    z-index: 5;
  }
  &:hover .photo {
    filter: grayscale(0%) contrast(1.05);
    opacity: 1;
  }
  &:hover .cap b {
    color: #ffffff;
  }

  .photo {
    display: block;
    width: 100%;
    height: 172px;
    object-fit: contain;
    filter: grayscale(100%) contrast(1.03);
    opacity: 0.9;
    transition: filter 0.32s ease, opacity 0.32s ease;
  }
  .sheen {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, transparent 34%, transparent 55%, rgba(0, 0, 0, 0.85) 100%);
  }
  .cap {
    position: absolute;
    left: 13px;
    bottom: 12px;
    right: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 3;
  }
  .cap .ic {
    display: flex;
    color: #ffffff;
    font-size: 13px;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.9));
  }
  .cap b {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.2px;
    text-shadow: 0 2px 5px rgba(0, 0, 0, 0.85);
  }

  /* ---- product frame variants ---- */
  &.k-canvas {
    border-radius: 3px;
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.8), 7px 7px 0 -2px rgba(0, 0, 0, 0.4);
  }
  &.k-frame {
    padding: 11px;
    background: #101010;
    .photo {
      height: 150px;
      box-shadow: inset 0 0 0 5px #050505;
    }
    .cap {
      left: 16px;
      right: 16px;
      bottom: 15px;
    }
  }
  &.k-print {
    padding: 8px 8px 30px;
    background: #e9e9e9;
    border-radius: 3px;
    .photo {
      height: 158px;
      opacity: 1;
    }
    .sheen {
      display: none;
    }
    .cap {
      bottom: 8px;
    }
    .cap b {
      color: #141414;
      text-shadow: none;
    }
    .cap .ic {
      color: #141414;
      filter: none;
    }
  }
  &.k-acrylic {
    border-radius: 10px;
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.25);
    &::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(115deg, rgba(255, 255, 255, 0.3), transparent 30%);
    }
  }
  &.k-book {
    border-radius: 3px 11px 11px 3px;
    &::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 11px;
      z-index: 2;
      background: linear-gradient(90deg, rgba(0, 0, 0, 0.6), rgba(255, 255, 255, 0.14) 55%, transparent);
    }
    .photo {
      height: 184px;
    }
    .cap {
      left: 20px;
    }
  }
  &.k-magnet {
    border-radius: 9px;
    border: 5px solid #f2f2f2;
    .photo {
      height: 132px;
      border-radius: 4px;
    }
  }

  .calStrip {
    background: #0e0e0e;
    padding: 8px 10px 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .calStrip .m {
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #ffffff;
    font-weight: 700;
    margin-bottom: 5px;
  }
  .calStrip .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }
  .calStrip .grid i {
    height: 7px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.12);
  }
  .calStrip .grid i.on {
    background: #ffffff;
  }

  .stripCells {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    background: #f2f2f2;
  }
  .stripCells img {
    width: 100%;
    height: 78px;
    object-fit: cover;
    display: block;
    filter: grayscale(100%);
  }
`;

const ProductCard = ({ item }) => {
  const { Icon } = item;
  return (
    <ProductBox className={`k-${item.kind}`}>
      {item.kind === "strip" ? (
        <div className="stripCells">
          {STRIP_SRCS.map((s, i) => (
            <img key={i} src={s} alt="" loading="lazy" draggable="false" />
          ))}
        </div>
      ) : (
        <img className="photo" src={item.src} alt={item.label} loading="lazy" draggable="false" />
      )}
      {item.kind === "calendar" && (
        <div className="calStrip">
          <div className="m">July 2026</div>
          <div className="grid">
            {Array.from({ length: 14 }).map((_, i) => (
              <i key={i} className={i === 9 ? "on" : ""} />
            ))}
          </div>
        </div>
      )}
      {item.kind !== "strip" && <div className="sheen" />}
      <div className="cap">
        <span className="ic">{Icon ? <Icon /> : null}</span>
        <b>{item.label}</b>
      </div>
    </ProductBox>
  );
};

/* ---------------- Left — brand + message ---------------- */
const Showcase = styled.section`
  position: relative;
  z-index: 3;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 64px clamp(40px, 6vw, 96px);
  pointer-events: none;

  /* Localized readability scrim: a soft dark wash anchored to the left edge that
   * fades out well before the page center, so the brand copy stays crisp while the
   * marquee (now only lightly tinted) still reads through the rest of the page. */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background: linear-gradient(
      100deg,
      rgba(0, 0, 0, 0.82) 0%,
      rgba(0, 0, 0, 0.62) 34%,
      rgba(0, 0, 0, 0.28) 62%,
      transparent 82%
    );
    -webkit-mask-image: radial-gradient(140% 120% at 0% 50%, #000 55%, transparent 100%);
    mask-image: radial-gradient(140% 120% at 0% 50%, #000 55%, transparent 100%);
  }

  @media (max-width: 940px) {
    display: none;
  }
`;

const Brandline = styled.div`
  display: flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 44px;
  opacity: 0;
  animation: ${rise} 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.05s forwards;

  b {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0.2px;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
  }
`;

const Mark = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  flex: none;
  background: #ffffff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  svg {
    width: 23px;
    height: 23px;
    path {
      stroke: #000;
    }
    circle {
      fill: #000;
    }
    rect {
      stroke: #000;
    }
  }
`;

const Kicker = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #d0d0d0;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.65);
  opacity: 0;
  animation: ${rise} 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;

  &::before {
    content: "";
    width: 42px;
    height: 1px;
    background: rgba(255, 255, 255, 0.5);
  }
`;

const Headline = styled.h2`
  max-width: 16ch;
  margin: 0 0 18px;
  font-size: clamp(34px, 4.4vw, 58px);
  line-height: 1.06;
  font-weight: 800;
  letter-spacing: -1.4px;
  text-wrap: balance;
  text-shadow: 0 2px 18px rgba(0, 0, 0, 0.55);
  opacity: 0;
  animation: ${rise} 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.16s forwards;

  em {
    font-style: normal;
    color: #ffffff;
    position: relative;
    white-space: nowrap;
  }
  em::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 4px;
    height: 8px;
    background: rgba(255, 255, 255, 0.16);
    z-index: -1;
  }
`;

const Sub = styled.p`
  margin: 0;
  color: #d2d2d2;
  font-size: clamp(14px, 1.15vw, 16.5px);
  max-width: 46ch;
  line-height: 1.65;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.6);
  opacity: 0;
  animation: ${rise} 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.24s forwards;
`;

/* ---------------- Right — glass auth ---------------- */
const Auth = styled.section`
  position: relative;
  z-index: 3;
  flex: none;
  width: clamp(420px, 42%, 560px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px clamp(28px, 4vw, 64px);

  @media (max-width: 940px) {
    width: 100%;
    padding: 28px 20px;
  }
`;

const GlassCard = styled.div`
  width: 100%;
  max-width: 400px;
  padding: 46px 40px 34px;
  border-radius: 22px;
  /* Reduced-opacity glass — the marquee stays slightly visible through it */
  background: rgba(16, 16, 20, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.13);
  box-shadow: 0 34px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 -1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(18px) saturate(120%);
  -webkit-backdrop-filter: blur(18px) saturate(120%);
  opacity: 0;
  animation: ${rise} 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;

  h1 {
    margin: 0 0 8px;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: #fff;
  }
  .lead {
    margin: 0 0 30px;
    color: #a8a8a8;
    font-size: 14.5px;
  }
`;

const MobileMark = styled.div`
  display: none;
  align-items: center;
  gap: 11px;
  margin-bottom: 26px;
  @media (max-width: 940px) {
    display: flex;
  }
  b {
    font-size: 17px;
    font-weight: 700;
  }
`;

/* ---- account picker (mirrors RememberedEmails behavior, dark B&W styling) ---- */
const PickerWrap = styled.div`
  margin: 0 0 20px;
`;

const PickerHeading = styled.div`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #8c8c8c;
  margin-bottom: 9px;
`;

const PickerList = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
`;

const PickerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 13px;
  cursor: pointer;
  transition: background 0.15s;
  background: ${(p) => (p.$active ? "rgba(255, 255, 255, 0.13)" : "transparent")};

  & + & {
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }
  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .uicon {
    color: #9a9a9a;
    display: flex;
    font-size: 17px;
  }
  .etext {
    flex: 1;
    font-size: 13.5px;
    color: #f0f0f0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const PickerRemove = styled.button`
  border: none;
  background: transparent;
  color: #8c8c8c;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 5px;
  border-radius: 7px;
  transition: color 0.15s, background 0.15s, box-shadow 0.15s;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }
  &:focus-visible {
    outline: none;
    color: #ffffff;
    box-shadow: 0 0 0 2px ${accent("50%")};
  }
`;

/* ---- multi-account dropdown (shown when >1 remembered email) ---- */
const Dropdown = styled.div`
  position: relative;
`;

const DropdownTrigger = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 13px;
  border-radius: 12px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: #f0f0f0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.07);
  }
  &:focus-visible {
    outline: none;
    border-color: ${accent("85%")};
    box-shadow: 0 0 0 3px ${accent("22%")};
  }

  .uicon {
    color: #9a9a9a;
    display: flex;
    font-size: 17px;
  }
  .etext {
    flex: 1;
    font-size: 13.5px;
    color: ${(p) => (p.$placeholder ? "#8c8c8c" : "#f0f0f0")};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chev {
    display: flex;
    color: #9a9a9a;
    font-size: 12px;
    transition: transform 0.2s ease;
    transform: rotate(${(p) => (p.$open ? "180deg" : "0deg")});
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 30;
  padding: 5px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(18, 18, 22, 0.92);
  box-shadow: 0 22px 50px rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(20px) saturate(120%);
  -webkit-backdrop-filter: blur(20px) saturate(120%);
  max-height: 240px;
  overflow-y: auto;
`;

const DropdownItem = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 11px;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.15s;
  background: ${(p) => (p.$active ? "rgba(255, 255, 255, 0.13)" : "transparent")};

  &:hover {
    background: rgba(255, 255, 255, 0.09);
  }

  .uicon {
    color: #9a9a9a;
    display: flex;
    font-size: 17px;
  }
  .etext {
    flex: 1;
    font-size: 13.5px;
    color: #f0f0f0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/* ---- remove-account confirmation dialog ---- */
const ConfirmOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  animation: ${fadeIn} 0.18s ease forwards;
`;

const ConfirmBox = styled.div`
  width: 100%;
  max-width: 360px;
  padding: 26px 26px 20px;
  border-radius: 16px;
  background: rgba(22, 22, 27, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.13);
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.6);
  text-align: center;
  animation: ${popIn} 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
`;

const ConfirmText = styled.p`
  margin: 0 0 22px;
  font-size: 15.5px;
  font-weight: 600;
  color: #f2f2f2;
  line-height: 1.5;
`;

const ConfirmActions = styled.div`
  display: flex;
  gap: 12px;
`;

const ConfirmButton = styled.button`
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  transition: transform 0.12s ease, background 0.2s ease, border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:active {
    transform: translateY(1px);
  }
  &:focus-visible {
    outline: none;
  }

  /* Monochrome, per the app's B&W convention (--destructive is black, not red):
   * the confirm action is emphasized by weight/fill (solid white), not by hue. */
  &.yes {
    color: #111111;
    background: #ffffff;
    border: 1px solid #ffffff;
    &:hover {
      background: #ececec;
    }
    &:focus-visible {
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.4);
    }
  }
  &.no {
    color: #e8e8e8;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.16);
    &:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    &:focus-visible {
      box-shadow: 0 0 0 3px ${accent("40%")};
    }
  }
`;

const Field = styled.div`
  margin-bottom: 14px;
`;

const InputWrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  /* Leading icon only — scoped to the direct-child svg so the password
   * show/hide toggle's own icon (nested in a button) keeps its own styling. */
  & > svg {
    position: absolute;
    left: 17px;
    width: 15px;
    height: 15px;
    color: #9a9a9a;
    transition: color 0.2s;
  }
  &:focus-within > svg {
    color: ${ACCENT};
  }
`;

/* Password show/hide toggle — sits at the right edge of the password field.
 * Monochrome to match the glass card; brightens on hover/focus. */
const PasswordToggle = styled.button`
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #9a9a9a;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }
  &:focus-visible {
    outline: none;
    color: #ffffff;
    box-shadow: 0 0 0 2px ${accent("50%")};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 15px 16px 15px 46px;
  border-radius: 12px;
  font-size: 14.5px;
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  outline: none;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  font-family: inherit;

  &::placeholder {
    color: #8c8c8c;
  }
  &:hover:not(:focus) {
    border-color: rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.08);
  }
  &:focus {
    background: rgba(255, 255, 255, 0.1);
    border-color: ${accent("85%")};
    box-shadow: 0 0 0 3px ${accent("22%")};
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: #000000;
  background: #ffffff;
  transition: transform 0.12s ease, box-shadow 0.25s ease, background 0.2s ease;
  margin-top: 22px;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.4);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    background: #f0f0f0;
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.5);
  }
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.4), 0 0 0 3px ${accent("55%")};
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const ErrorText = styled.p`
  margin: 0 0 14px;
  font-size: 13px;
  color: #ff9b9b;
  text-align: center;
`;

/* Inline submit spinner — dark on the white button, matching the app's .spinner idiom */
const Spinner = styled.span`
  width: 16px;
  height: 16px;
  flex: none;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.22);
  border-top-color: #000000;
  animation: ${spin} 0.7s linear infinite;
`;

const Foot = styled.p`
  margin-top: 26px;
  text-align: center;
  font-size: 12.5px;
  color: #8c8c8c;
  a {
    color: #dcdcdc;
    text-decoration: none;
    font-weight: 500;
  }
  a:hover {
    color: #ffffff;
    text-decoration: underline;
  }
`;

const LogoSvg = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M4 16l4.5-5 3 3.2L15 9l5 7" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="8.4" cy="7.2" r="1.9" fill="#fff" />
    <rect x="2.6" y="3.2" width="18.8" height="17.6" rx="3.2" stroke="#fff" strokeWidth="1.6" opacity="0.65" />
  </svg>
);

const FALLBACK_DOMAIN = "https://editor.magzapp.in";
const getDomain = () => {
  const h = window.location.hostname;
  // Desktop (Electron, app://) and local dev have no real brand domain — use the fallback.
  if (
    isDesktop ||
    h === "localhost" ||
    h.includes("trycloudflare") ||
    h === "127.0.0.1" ||
    h === ""
  )
    return FALLBACK_DOMAIN;
  return `${window.location.protocol}//${h}`;
};

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Previously-used emails on this device (never passwords). Read once — the list
  // is already restored into localStorage by hydrateAuthSession before the router
  // renders, so this is populated on first paint.
  const [rememberedEmails, setRememberedEmails] = useState(() => getRememberedEmails());
  // Multi-account dropdown open state + the email queued for removal confirmation.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const passwordRef = useRef(null);
  const dropdownRef = useRef(null);
  const emailRef = useRef(null);

  const hasMultipleAccounts = rememberedEmails && rememberedEmails.length > 1;

  // Close the dropdown on outside click / Escape (Escape also closes the confirm
  // dialog). Only wired while something is open so there's no idle listener.
  useEffect(() => {
    if (!pickerOpen && !pendingRemoval) return undefined;
    const onPointerDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (pendingRemoval) setPendingRemoval(null);
      else setPickerOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen, pendingRemoval]);

  // Always focus the email field when the login screen is displayed (on mount).
  // A ref + effect is more reliable than the `autoFocus` attribute under the SPA
  // router, where the element may mount without the browser applying autofocus.
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Pick a remembered account: fill the email, autofill the saved password
  // (fetched from the encrypted keychain on desktop) AND sign in immediately —
  // one-click re-login. The credentials are handed straight to performLogin so
  // the submit doesn't have to wait on the email/password state flushing. If no
  // password was saved we can't auto-submit, so fall back to filling the email
  // and focusing the password field to type.
  const handlePickEmail = (picked) => {
    setEmail(picked);
    setError("");
    setPickerOpen(false);
    getRememberedPassword(picked)
      .then((pw) => {
        if (pw) {
          setPassword(pw);
          performLogin(picked, pw);
        } else {
          requestAnimationFrame(() => passwordRef.current?.focus());
        }
      })
      .catch(() => requestAnimationFrame(() => passwordRef.current?.focus()));
  };

  // Removing an account is confirmed via a dialog — the X only *queues* the email;
  // the actual removal happens on "Yes".
  const requestForgetEmail = (picked) => {
    setPendingRemoval(picked);
  };

  const confirmForgetEmail = () => {
    if (!pendingRemoval) return;
    const updated = removeRememberedEmail(pendingRemoval);
    setRememberedEmails(updated);
    // If the removed account was the one filled in, clear the fields so a stale
    // email/password doesn't linger.
    if (email && email.toLowerCase() === pendingRemoval.toLowerCase()) {
      setEmail("");
      setPassword("");
    }
    if (!updated || updated.length <= 1) setPickerOpen(false);
    setPendingRemoval(null);
  };

  const cancelForgetEmail = () => {
    setPendingRemoval(null);
  };

  // Persist the authenticated user so apiCall (which reads the token + ids from
  // localStorage) works immediately on the next page, then route to the design
  // selection screen. The login `items` carry accessToken/brand_id/store_id;
  // DesignSelectionPage enriches the record (e.g. _id, userTypeCode) from the
  // token via fetchUserDataFromToken before issuing data calls.
  const redirectAfterLogin = (user) => {
    const token = user?.accessToken;
    const stored = { ...user, token };
    // Fresh login starts a clean session — never resume a previous user's editor
    // or restore their locally-snapshotted working state.
    clearLastOpenEditor();
    clearEditorSnapshot();
    // Persist the session to localStorage AND the durable OS keychain (desktop)
    // so a reopened app keeps the user signed in instead of showing Login.
    setStoredUser(stored);
    dispatch(setUserDetails(stored));
    // Both web (BrowserRouter) and desktop (HashRouter) route through react-router,
    // so a single SPA navigate keeps the token in `location.search` either way.
    navigate(`/design?u_id=${encodeURIComponent(token || "")}`);
  };

  // Core login routine — shared by the manual form submit and the one-click
  // account-picker auto-login. Takes explicit credentials (rather than reading
  // the email/password state) so the picker can sign in the instant an account
  // is chosen, without waiting for a React state flush.
  const performLogin = async (loginEmail, loginPassword) => {
    if (!loginEmail || !loginPassword) {
      setError("Please enter email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiPost(
        ENDPOINTS.authLogin,
        { email: loginEmail, password: loginPassword, domain: getDomain() },
        { skipBrandId: true },
      );
      if (data?.status === 1 && data?.items) {
        const user =
          typeof data.items === "string" ?
            decryptLoginResponse(data.items)
            : data.items;
        // Remember this account (email + password) on the device so the login
        // screen's account picker can offer one-click re-login next time.
        rememberCredential(loginEmail, loginPassword);
        dispatch(setAuthItems(user));
        redirectAfterLogin(user);
      } else {
        setError(data?.message || "Login failed. Please try again.");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = (e) => {
    e.preventDefault();
    performLogin(email, password);
  };

  
  return (
    <Page>
      {/* Full-page marquee of every editor type */}
      <Marquee aria-hidden="true">
        {COLUMNS.map((col, ci) => (
          <Col key={ci}>
            <Track $dur={col.dur} $reverse={ci % 2 === 1}>
              {Array.from({ length: COL_REPEAT }).flatMap((_, r) =>
                col.items.map((idx, k) => <ProductCard key={`${r}-${k}`} item={SHOWCASE[idx]} />),
              )}
            </Track>
          </Col>
        ))}
      </Marquee>
      <Overlay />
      <Grain />

      {/* LEFT — brand + message */}
      <Showcase>
        <Brandline>
          <Mark>{LogoSvg}</Mark>
          <b>Printpoz Design</b>
        </Brandline>
        <Kicker>Personalised Print Studio</Kicker>
        <Headline>
          Turn moments into things you can <em>hold.</em>
        </Headline>
        <Sub>
          Photobooks, calendars, canvas and wall art — designed in one place, printed to keep. Sign in to pick up right
          where you left off.
        </Sub>
      </Showcase>

      {/* RIGHT — glass auth */}
      <Auth>
        <GlassCard>
          <MobileMark>
            <Mark>{LogoSvg}</Mark>
            <b>Photo Editor</b>
          </MobileMark>

          <h1>Welcome back</h1>
          <p className="lead">Sign in to continue to your studio.</p>

          {error && <ErrorText role="alert">{error}</ErrorText>}

          {rememberedEmails && rememberedEmails.length > 0 && (
            <PickerWrap>
              <PickerHeading>Sign in as</PickerHeading>
              {hasMultipleAccounts ? (
                /* Multiple accounts → compact dropdown for a cleaner list */
                <Dropdown ref={dropdownRef}>
                  <DropdownTrigger
                    type="button"
                    $open={pickerOpen}
                    $placeholder={!email}
                    aria-haspopup="listbox"
                    aria-expanded={pickerOpen}
                    onClick={() => setPickerOpen((o) => !o)}
                  >
                    <span className="uicon">
                      <FaRegUserCircle />
                    </span>
                    <span className="etext">{email || "Choose an account"}</span>
                    <span className="chev">
                      <FaChevronDown />
                    </span>
                  </DropdownTrigger>
                  {pickerOpen && (
                    <DropdownMenu role="listbox">
                      {rememberedEmails.map((addr) => (
                        <DropdownItem
                          key={addr}
                          role="option"
                          aria-selected={email && email.toLowerCase() === addr.toLowerCase()}
                          $active={email && email.toLowerCase() === addr.toLowerCase()}
                          onClick={() => handlePickEmail(addr)}
                          title={`Sign in as ${addr}`}
                        >
                          <span className="uicon">
                            <FaRegUserCircle />
                          </span>
                          <span className="etext">{addr}</span>
                          <PickerRemove
                            type="button"
                            aria-label={`Remove ${addr}`}
                            title="Remove this account"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestForgetEmail(addr);
                            }}
                          >
                            <FaTimes size={12} />
                          </PickerRemove>
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  )}
                </Dropdown>
              ) : (
                /* Single account → keep the inline row */
                <PickerList>
                  {rememberedEmails.map((addr) => (
                    <PickerRow
                      key={addr}
                      $active={email && email.toLowerCase() === addr.toLowerCase()}
                      onClick={() => handlePickEmail(addr)}
                      title={`Sign in as ${addr}`}
                    >
                      <span className="uicon">
                        <FaRegUserCircle />
                      </span>
                      <span className="etext">{addr}</span>
                      <PickerRemove
                        type="button"
                        aria-label={`Remove ${addr}`}
                        title="Remove this account"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestForgetEmail(addr);
                        }}
                      >
                        <FaTimes size={12} />
                      </PickerRemove>
                    </PickerRow>
                  ))}
                </PickerList>
              )}
            </PickerWrap>
          )}

          <form onSubmit={handleEmailLogin}>
            <Field>
              <InputWrap>
                <FaEnvelope />
                <Input
                  ref={emailRef}
                  type="email"
                  placeholder="Email address"
                  value={email}
                  name="email"
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </InputWrap>
            </Field>
            <Field>
              <InputWrap>
                <FaLock />
                <Input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 46 }}
                />
                <PasswordToggle
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </PasswordToggle>
              </InputWrap>
            </Field>
            <SubmitButton type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                "Log in"
              )}
            </SubmitButton>
          </form>
        </GlassCard>
      </Auth>

      {/* Remove-account confirmation */}
      {pendingRemoval && (
        <ConfirmOverlay onMouseDown={cancelForgetEmail}>
          <ConfirmBox
            role="alertdialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ConfirmText>Do you want to remove this account?</ConfirmText>
            <ConfirmActions>
              <ConfirmButton type="button" className="yes" onClick={confirmForgetEmail}>
                Yes
              </ConfirmButton>
              <ConfirmButton type="button" className="no" onClick={cancelForgetEmail}>
                No
              </ConfirmButton>
            </ConfirmActions>
          </ConfirmBox>
        </ConfirmOverlay>
      )}
    </Page>
  );
};

export default LoginPage;
