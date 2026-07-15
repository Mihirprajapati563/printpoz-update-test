import styled from "styled-components";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import { createGlobalStyle } from "styled-components";
import eyeIcon from "../assets/icons/eye_icon.svg";
import { Collapse, Tab, Tabs } from "react-bootstrap";
import Form from "react-bootstrap/Form";

export const theme = {
  colors: {
    primaryColor: "#4084B5",
    secondaryColor: "#EFF8FF",
    backgroundColor: "#f5f5f5",
    textcolor: "#333",
  },
  fonts: {
    main: "Roboto, sans-serif",
  },
  spacing: {
    small: "8px",
    medium: "16px",
    large: "24px",
  },
};

export const GlobalStyles = createGlobalStyle`
  body {
    background-color:#F6F6F6;
    font-family: 'Roboto', sans-serif !important;
    overflow-x:hidden;
    color:#696969;
  }

  .App{
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    position:relative;
  }

.primary-color {
    color: ${(props) => props.theme.colors.primaryColor};
}
.primary-bg {
    background-color: ${(props) => props.theme.colors.primaryColor} !important;
}
.btn.primary-bg {
    background-color: ${(props) => props.theme.colors.primaryColor} !important;
    border-color: ${(props) => props.theme.colors.primaryColor} !important;
    color: #fff !important;
}
.btn-outline-primary.dropdown button {
    background: transparent !important;
    border-width: 1px !important;
    border-stayle:solid !important;
    border-color: ${(props) => props.theme.colors.primaryColor} !important;
    color:${(props) => props.theme.colors.primaryColor} !important;
    padding: 2px !important;
}

.btn-outline-primary.dropdown button:hover {
    background: ${(props) => props.theme.colors.primaryColor} !important;
    border-width: 1px !important;
    border-stayle:solid !important;
    border-color: ${(props) => props.theme.colors.primaryColor} !important;
    color: #fff !important;
}
.back-to-top {
    position: fixed;
    bottom: 85px;
    right: 0px;
    background: ${(props) => props.theme.colors.primaryColor} !important;
    padding: 8px;
    color: white;
    border-radius: 50%;
    border: none;
    box-shadow: 0 5px 10px #ccc;
    z-index: 9999;
}
.side-nav a {
    display: block;
    padding: 10px;
    color: #666;
    text-decoration: none;
    text-transform: uppercase;
    margin: 5px 0px !important;
}
.side-nav .submenu a:before {
    content: "";
    position: absolute;
    top: 20px;
    left: 0px;
    height: 5px;
    width: 5px;
    border-radius: 50%;
    background-color: #666;
    line-height: 5px !important;
}
.side-nav .submenu a.active:before {
    content: "";
    position: absolute;
    top: 20px;
    left: 0px;
    height: 5px;
    width: 5px;
    border-radius: 50%;
    background-color: ${(props) => props.theme.colors.primaryColor} !important;
    line-height: 5px !important;
}
.admin-icon,.admin-title{
    color:#fff !important;
}
.side-nav .submenu a.active {
    border-left: none !important;
    background-color: transparent !important;
    color: ${(props) => props.theme.colors.primaryColor} !important;
}
.cursor-pointer{
cursor:pointer;
}
.flex-1{
flex:1;
}
.icon-18 svg{
width:18px !Important;
height:18px !Important;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 22px;
}

.switch .switch-input {
  display: none;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #dedede;
  border-radius: 40px;
  -webkit-transition: 0.4s;
  transition: 0.4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  background: #fff;
  border-radius: 50%;
  left: 2px;
  bottom: 1px;
  -webkit-transition: 0.4s;
  transition: 0.4s;
 background-image: url(${eyeIcon});
 background-size:78%;
  background-position: center;
  background-repeat: no-repeat;
}

.switch-input:checked + .slider {
  background: #4084B5;
}

.switch-input:checked + .slider:before {
  -webkit-transform: translateX(20px);
  -moz-transform: translateX(20px);
  transform: translateX(20px);
}

.switch-input:focus + .slider {
}

.side-bar-scroll{
   &::-webkit-scrollbar {
    width: 4px !important; 
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1 !important; 
  }

  &::-webkit-scrollbar-thumb {
    background: #888 !important; 
    border-radius: 10px !important; 
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #555 !important; 
  }
}

.horizontal-scroll{
   &::-webkit-scrollbar {
    height: 4px !important; 
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1 !important; 
  }

  &::-webkit-scrollbar-thumb {
    background: #888 !important; 
    border-radius: 10px !important; 
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #555 !important; 
  }
}
.hide-scroll{
&::-webkit-scrollbar {
    display: none;
  }
}

.photo-box{
    height: calc(100vh - 250px) !important;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0px;
}
.layout-box{
    height: calc(100vh - 250px) !important;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0px;
    text-align: center;
}

.bg-box{
    height: calc(100vh - 245px) !important;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0px;
}
@media(max-width:724px){
  .layout-box{
    height: auto !important;}
}
.sticker-box .tab-content{
    height: calc(100vh - 210px) !important;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0px;

    &::-webkit-scrollbar {
    width: 4px !important; 
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1 !important; 
  }

  &::-webkit-scrollbar-thumb {
    background: #888 !important; 
    border-radius: 10px !important; 
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #555 !important; 
  }
}


.background-box{
  height: calc(100vh) !important;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0px;

  &::-webkit-scrollbar {
  width: 4px !important; 
}

&::-webkit-scrollbar-track {
  background: #f1f1f1 !important; 
}

&::-webkit-scrollbar-thumb {
  background: #888 !important; 
  border-radius: 10px !important; 
}

&::-webkit-scrollbar-thumb:hover {
  background: #555 !important; 
}
}

.theme-box{
    height: calc(100vh - 265px) !important;
    overflow-x: hidden;
    overflow-y: auto;
}

.frame-box{
    height: calc(100vh - 155px) !important;
    overflow-x: hidden;
    overflow-y: auto;
}
.frame-box-inner{
    height: calc(100vh - 170px) !important;
    overflow-x: hidden;
    overflow-y: auto;
}
.mask-container {

  max-height: calc(100vh - 110px); /* 100vh minus the height of the header */
  overflow-y: auto; /* Enable vertical scrolling when content exceeds the height */
}
.masks-box{
    height: calc(100vh - 221px) !important;
    overflow-x: hidden;
    overflow-y: auto;
}
.masks-box:last-child{
    height: calc(100vh - 211px) !important;
    overflow-x: hidden;
    overflow-y: auto;
}

.sticker-container {

  max-height: calc(100vh - 110px); /* 100vh minus the height of the header */
  overflow-y: auto; /* Enable vertical scrolling when content exceeds the height */
}


.sticker-item {
  transition: transform 0.3s, box-shadow 0.3s; /* Smooth transition */
}
  
.sticker-item:hover {
  transform: scale(1.1); /* Slightly scale the sticker on hover */
}
.sticker-pagination {
  
}


.theme-container {

  max-height: calc(100vh - 110px); /* 100vh minus the height of the header */
  overflow-y: auto; /* Enable vertical scrolling when content exceeds the height */
}

.theme-item {
  transition: transform 0.3s, box-shadow 0.3s; /* Smooth transition */
}
  
.theme-item:hover {
  transform: scale(1.1); /* Slightly scale the sticker on hover */
}
.theme-pagination {
  
}

.bg-item {
  transition: transform 0.3s, box-shadow 0.3s; /* Smooth transition */
}
  
.bg-item:hover {
  transform: scale(1.1); /* Slightly scale the sticker on hover */
}

.text-caption-box{
    height: calc(100vh - 433px) !important;
    overflow-x: hidden;
    overflow-y: auto;
}


.radio input[type="radio"] {
  position: absolute;
  opacity: 0;
}
.radio input[type="radio"] + .radio-label {
font-family: Roboto;
font-size: 14px;
font-weight: 700;
line-height: 19px;
color:#696969;
cursor:pointer;
}
.radio input[type="radio"] + .radio-label:before {
  content: '';
  // background: #b4b4b4; 
  border-radius: 100%;
  box-shadow: inset 0 0 0 4px #fff;
  border: 1px solid #4084B5;
  display: inline-block;
  width: 18px;
  height: 18px;
  position: relative;
    top: 0px;
    margin-right: 5px;
  vertical-align: top;
  cursor: pointer;
  text-align: center;
  transition: all 250ms ease;
  cursor:pointer;
}
.radio input[type="radio"]:checked + .radio-label:before {
  background-color: #4084B5;
  box-shadow: inset 0 0 0 4px #fff; 
}
.radio input[type="radio"]:focus + .radio-label:before {
  outline: none;
  border-color: #4084B5; 
}
.radio input[type="radio"]:disabled + .radio-label:before {
  box-shadow: inset 0 0 0 4px #fff; 
  border-color: #cdcdcd;
  background: #cdcdcd; 
}
.radio input[type="radio"] + .radio-label:empty:before {
  margin-right: 0;
}


.swiper {
  width: 100%;
  height: 100%;
}
.swiper-slide {
  text-align: center;
  font-size: 12px;
  background: #fff;

  /* Center slide text vertically */
  display: flex;
  justify-content: center;
  align-items: center;
}
.swiper-slide img {
  display: block;
  width: 100%;
  height: 100%;
}
/* Slider.css */
.swiper-button-prev,
.swiper-button-next {
  width: 40px; 
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.swiper-button-prev::after,
.swiper-button-next::after {
  font-size: 12px; 
  color: #000; 
  background-color: #fff; 
  border-radius: 50%; 
  box-shadow: 0px 0px 10px 0px #00000024;
  height:24px;
  width:24px;
  display:flex;
  align-items:center;
  justify-content:center;
}
  .swiper-button-prev:hover::after,
.swiper-button-next:hover::after{
color: ${(props) => props.theme.colors.primaryColor} !important;
}

.swiper-button-prev {
  left: -5px; 
}

.swiper-button-next {
  right: -5px; 
}

.inset-0 {
    left: 0;
    right: 0;
    bottom: 0;
    top: 0;
}

.CanvasWrapper {
    flex: 1 1 0%;
}
.canvas-box {
    margin: 0 auto;
    width: -webkit-fit-content;
    width: -moz-fit-content;
     width: fit-content;
    //width: 100%;
    //border: 3px solid transparent;
}
.selected-left {
    border-top: 2px solid blue;
    border-bottom: 2px solid blue;
    border-left: 2px solid blue;
}

.selected-right {
    border-top: 2px solid blue;
    border-bottom: 2px solid blue;
    border-right: 2px solid blue;
}
.leftSide:before {
  
}
.rightSide:before {
}
.WrapperDiv {
    // overflow: hidden;
    
 
}
.WrapperDivLine {
    &::after {
    content: ""; /* Ensure the pseudo-element is generated */
    position: absolute;
    z-index: 10;
    top: 0;
    bottom: 0;
    left: 50%;
    border-left: 2px solid #D3D3D3;
    transform: translateX(-50%);
    box-shadow: 0 0 15px 1px rgba(0, 0, 0, 0.5);
  }
  &::before {
    
  }
 
}

.preview-add-page-button{
  position: absolute;
    display: flex;
    flex-direction: column;
    align-content: center;
    justify-content: center;
    align-items: center;
    width: 26px;
    height: 26px;
    border-radius: 4px;
    top: 42%;
    right: -14px;
    fill: #949494;
    margin-top: -10px;
    cursor: pointer;
     transition: transform 0.3s ease-in-out;
}

.preview-add-page-button:hover {
 fill:#0070ff;
  transform: scale(1.6); /* Slightly scale the sticker on hover */
}

.noPointer {
    pointer-events: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
}

.fade-animate {
  animation: Fade 0.5s ease-out forwards;
}

/* Define the keyframes for the animation */
@keyframes Fade {
  0% {
    opacity: 0;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  
  }
}



`;

export const HeaderWrapper = styled.div`
width:100%;
height:69px;
background-color: #fff !important;
padding:10px 25px;
box-shadow: 0px 4px 4px 0px #0000001F;
display:flex;
flex-direction:column;
justify-content:center;
}
`;
export const BrandTitle = styled.div`
font-family: Archivo Black;
font-size: 35px;
font-weight: 400;
line-height: 38.08px;
text-align: left;
color: ${(props) => props.theme.colors.primaryColor};
@media(max-width:724px){
  display: none;
}
}
`;
export const MainContentWrapper = styled.div`
flex-grow:1;
display:flex;
@media(max-width:724px){
  display: grid;
  grid-template-rows: 1fr 78px;
}
}
`;
export const TextInput = styled.input.attrs((props) => ({
  type: props.type || "text",
}))`
  width: 100%;
  padding: ${(props) =>
    props.size === "sm"
      ? "4px 8px;"
      : props.size === "lg"
      ? "8px 16px;"
      : "6px 12px"};
  font-size: ${(props) =>
    props.size === "sm" ? "14px" : props.size === "lg" ? "20px" : "16px"};
  border-radius: ${(props) =>
    props.size === "sm" ? "4px" : props.size === "lg" ? "8px" : "6px"};
  &:focus {
    border-color: #0d3f5f;
    outline: 0;
    box-shadow: 0 0 0 4px rgb(13 63 95 / 15%) !important;
  }
`;
export const ModalHeader = styled(Modal.Header)`
  background-color: ${(props) =>
    props.bgColor ? props.bgColor : "#fff"} !important;
`;

export const DisplayStart = styled.div`
  width: ${(props) => (props.width ? props.width : "auto")};
  margin-bottom: ${(props) => (props.mb ? props.mb : null)};
  margin-left: ${(props) => (props.ml ? props.ml : null)};
  margin-right: ${(props) => (props.mr ? props.mr : null)};
  margin-top: ${(props) => (props.mt ? props.mt : null)};
  padding-top: ${(props) => (props.pt ? props.pt : null)};
  padding-bottom: ${(props) => (props.pb ? props.pb : null)};
  padding-left: ${(props) => (props.pl ? props.pl : null)};
  padding-right: ${(props) => (props.pr ? props.pr : null)};
  display: flex;
  flex-direction: ${(props) => (props.direction ? props.direction : "row")};
  align-items: ${(props) =>
    props.verticalalign ? props.verticalalign : "center"};
  justify-content: start;
  gap: ${(props) => (props.gap ? props.gap : "0px")};
`;
export const DisplayCenter = styled.div`
  width: ${(props) => (props.width ? props.width : "auto")};
  margin-bottom: ${(props) => (props.mb ? props.mb : null)};
  margin-left: ${(props) => (props.ml ? props.ml : null)};
  margin-right: ${(props) => (props.mr ? props.mr : null)};
  margin-top: ${(props) => (props.mt ? props.mt : null)};
  padding-top: ${(props) => (props.pt ? props.pt : null)};
  padding-bottom: ${(props) => (props.pb ? props.pb : null)};
  padding-left: ${(props) => (props.pl ? props.pl : null)};
  padding-right: ${(props) => (props.pr ? props.pr : null)};
  display: flex;
  align-items: ${(props) =>
    props.verticalAlign ? props.verticalAlign : "center"};
  justify-content: center;
  @media (max-width: 724px) {
    flex-wrap: wrap;
    grid-gap: 10px;
  }
`;
export const DisplayEnd = styled.div`
  width: ${(props) => (props.width ? props.width : "auto")};
  margin-bottom: ${(props) => (props.mb ? props.mb : null)};
  margin-left: ${(props) => (props.ml ? props.ml : null)};
  margin-right: ${(props) => (props.mr ? props.mr : null)};
  margin-top: ${(props) => (props.mt ? props.mt : null)};
  padding-top: ${(props) => (props.pt ? props.pt : null)};
  padding-bottom: ${(props) => (props.pb ? props.pb : null)};
  padding-left: ${(props) => (props.pl ? props.pl : null)};
  padding-right: ${(props) => (props.pr ? props.pr : null)};
  display: flex;
  align-items: ${(props) =>
    props.verticalAlign ? props.verticalAlign : "center"};
  justify-content: end;
`;
export const DisplayBetween = styled.div`
  width: ${(props) => (props.width ? props.width : "auto")};
  margin-bottom: ${(props) => (props.mb ? props.mb : null)};
  margin-left: ${(props) => (props.ml ? props.ml : null)};
  margin-right: ${(props) => (props.mr ? props.mr : null)};
  margin-top: ${(props) => (props.mt ? props.mt : null)};
  padding-top: ${(props) => (props.pt ? props.pt : null)};
  padding-bottom: ${(props) => (props.pb ? props.pb : null)};
  padding-left: ${(props) => (props.pl ? props.pl : null)};
  padding-right: ${(props) => (props.pr ? props.pr : null)};
  display: flex;
  align-items: ${(props) =>
    props.verticalAlign ? props.verticalAlign : "center"};
  justify-content: space-between;
  flex-wrap: ${(props) => (props.flexwrap ? props.flexwrap : "wrap")};
  gap: ${(props) => (props.gap ? props.gap : "0px")};
  @media (max-width: 724px) {
    &.canvas-bottom {
      grid-gap: 10px;
      margin-bottom: 10px;
      justify-content: center;
    }
  }
`;

export const InlineBox = styled.div`
  margin-left: ${(props) => (props.ml ? props.ml : "0px")};
  display: inline-block;
`;
export const Box = styled.div`
  display: block;
  margin-top: ${(props) => (props.mt ? props.mt : null)};
  margin-bottom: ${(props) => (props.mb ? props.mb : null)};
  margin-left: ${(props) => (props.ml ? props.ml : null)};
  margin-right: ${(props) => (props.mr ? props.mr : null)};
  margin-top: ${(props) => (props.mt ? props.mt : null)};
  padding-top: ${(props) => (props.pt ? props.pt : null)};
  padding-bottom: ${(props) => (props.pb ? props.pb : null)};
  padding-left: ${(props) => (props.pl ? props.pl : null)};
  padding-right: ${(props) => (props.pr ? props.pr : null)};
  cursor: ${(props) => (props.cursor ? props.cursor : null)};
  width: ${(props) => (props.width ? props.width : null)};

  @media (min-width: 724px) {
    .arrow_title {
      display: none;
    }
  }
`;
export const UploadImgBtn = styled.label`
  color: #333 !important;
  background-color: #fff !important;
  border: 1px solid #ccc !important;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  width: 100%;
  font-size: 14px !important;
  cursor: pointer;
  &:hover {
    color: #333 !important;
    background-color: #e6e6e6 !important;
    border-color: #adadad !important;
  }
`;
export const BorderBox = styled.div`
  border-top: ${(props) =>
    props.borderTop ? props.borderTop : "1px solid #dee2e6"};
  border-bottom: ${(props) =>
    props.borderBottom ? props.borderBottom : "1px solid #dee2e6"};
  margin-left: ${(props) => (props.ml ? props.ml : null)};
  margin-right: ${(props) => (props.mr ? props.mr : null)};
  margin-top: ${(props) => (props.mt ? props.mt : null)};
  margin-bottom: ${(props) => (props.mb ? props.mb : null)};
  padding-top: ${(props) => (props.pt ? props.pt : "8px")};
  padding-bottom: ${(props) => (props.pb ? props.pb : "8px")};
  padding-left: ${(props) => (props.pl ? props.pl : null)};
  padding-right: ${(props) => (props.pr ? props.pr : null)};
`;
export const Heading = styled.div`
  font-size: ${(props) => (props.fontsize ? props.fontsize : "24px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "500")};
  color: ${(props) => (props.color ? props.color : "#666666")};
  position: relative;
  margin-bottom: ${(props) => (props.mb ? props.mb : "0px")};
  margin-top: ${(props) => (props.mt ? props.mt : "0px")};
`;
export const BodyText = styled.div`
  font-size: ${(props) => (props.fontsize ? props.fontsize : "14px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "400")};
  line-height: ${(props) => (props.lineheight ? props.lineheight : "1.5")};
  color: ${(props) => (props.textcolor ? props.textcolor : "#666666")};
  margin-top: ${(props) => (props.mt ? props.mt : "0px")};
  margin-bottom: ${(props) => (props.mb ? props.mb : "0px")};
  margin-left: ${(props) => (props.ml ? props.ml : "0px")};
  margin-right: ${(props) => (props.mr ? props.mr : "0px")};
  text-align: ${(props) => (props.textAlign ? props.textAlign : "left")};
  padding-left: ${(props) => (props.pl ? props.pl : null)};
  padding-right: ${(props) => (props.pr ? props.pr : null)};
  margin-bottom: ${(props) => (props.mb ? props.mb : null)};
  padding-top: ${(props) => (props.pt ? props.pt : null)};
  padding-bottom: ${(props) => (props.pb ? props.pb : null)};
  display: ${(props) => (props.display ? props.display : null)};
  @media (max-width: 724px) {
    &.mob_text_flex {
      margin-left: 20px;
    }
    &.photo_back_heading {
      display: none;
    }
  }
`;
export const PrimaryButton = styled(Button)`
  font-family: Roboto;
  line-height: 18.75px;
  text-align: center;
  font-size: ${(props) => (props.fontsize ? props.fontsize : "16px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "500")};
  background-color: ${(props) => props.theme.colors.primaryColor};
  border: none;
  border-radius: ${(props) => (props.radius ? props.radius : "10px")};
  color: ${(props) => (props.textcolor ? props.textcolor : "#fff")};
  padding-top: ${(props) => (props.pt ? props.pt : "7px")};
  padding-bottom: ${(props) => (props.pb ? props.pb : "7px")};
  padding-left: ${(props) => (props.pl ? props.pl : "16px")};
  padding-right: ${(props) => (props.pr ? props.pr : "16px")};
  margin-top: ${(props) => (props.mt ? props.mt : "0px")};
  margin-bottom: ${(props) => (props.mb ? props.mb : "0px")};
  margin-left: ${(props) => (props.ml ? props.ml : "0px")};
  margin-right: ${(props) => (props.mr ? props.mr : "0px")};
  &:hover {
    background-color: ${(props) => props.theme.colors.primaryColor};
    color: ${(props) => (props.textcolor ? props.textcolor : "#fff")};
  }

  &:active {
    background-color: ${(props) => props.theme.colors.primaryColor}!important;
    color: ${(props) => (props.textcolor ? props.textcolor : "#fff")}!important;
    border: none !important;
  }
  &:focus-visible {
    background-color: ${(props) => props.theme.colors.primaryColor}!important;
    color: ${(props) => (props.textcolor ? props.textcolor : "#fff")}!important;
    outline: none !important;
  }

  & span {
    margin-top: 3px;
    margin-left: 7px;
  }

  @media (max-width: 724px) {
    & span {
      display: none;
    }
    padding: 8px 10px;
    & svg {
      height: 18px;
    }
  }
`;
export const LightPrimaryButton = styled(Button)`
  font-family: Roboto;
  text-align: center;
  font-size: ${(props) => (props.fontsize ? props.fontsize : "16px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "500")};
  background-color: ${(props) => props.theme.colors.secondaryColor};
  display: flex;
  align-items: center;
  border: none;
  border-radius: 10px;
  color: ${(props) => props.theme.colors.primaryColor};
  padding-top: ${(props) => (props.pt ? props.pt : "7px")};
  padding-bottom: ${(props) => (props.pb ? props.pb : "7px")};
  padding-left: ${(props) => (props.pl ? props.pl : "16px")};
  padding-right: ${(props) => (props.pr ? props.pr : "16px")};
  margin-top: ${(props) => (props.mt ? props.mt : "0px")};
  margin-bottom: ${(props) => (props.mb ? props.mb : "0px")};
  margin-left: ${(props) => (props.ml ? props.ml : "0px")};
  margin-right: ${(props) => (props.mr ? props.mr : "0px")};

  &:hover {
    background-color: ${(props) => props.theme.colors.primaryColor} !important;
    color: ${(props) => props.theme.colors.secondaryColor}!important;
    border: none !important;
  }
  &:active {
    background-color: ${(props) => props.theme.colors.secondaryColor}!important;
    color: ${(props) => props.theme.colors.primaryColor}!important;
    border: none !important;
  }
  &:focus-visible {
    background-color: ${(props) => props.theme.colors.secondaryColor}!important;
    color: ${(props) => props.theme.colors.primaryColor}!important;
    outline: none !important;
  }

  & span {
    margin-top: 3px;
    margin-left: 7px;
  }

  @media (max-width: 724px) {
    padding: 8px 10px;
    span {
      display: none;
    }
    svg {
      width: 18px;
    }
  }
`;

export const AlertBox = styled.div`
  background-color: ${(props) => (props.bgcolor ? props.bgcolor : null)};
  padding: ${(props) => (props.padding ? props.padding : "7px")};
  background-color: ${(props) => (props.bgcolor ? props.bgcolor : null)};
  color: ${(props) => (props.textcolor ? props.textcolor : "#000")};
  border: ${(props) =>
    props.borderColor ? `1px solid ${props.borderColor}` : null};
  border-radius: 4px;
  text-align: center;
`;

export const SidebarWrapper = styled.div`
  display: flex;
  background-color: #fff;
  // height: calc(100vh - 69px);
  @media (max-width: 724px) {
    grid-row: 2/3;
    overflow-x: auto;
    overflow-y: visible;
  }
`;
export const CanvasWrapper = styled.div`
  margin: 10px 10px;
  flex-grow: 1;
`;
export const CanvasBox = styled.div`
  border: 1px solid #c1c1c1;
  padding: 20px;
  height: ${({ height }) => height};
  // height:370px;
`;
export const ContentWrapper = styled.div`
display:flex;
flex-direction:column;
width:100%;
// height:calc(100vh - 69px);
}
`;
export const FooterWrapper = styled.div`
  display: flex;
  background-color: #fff;
  height: 119px;
  padding: 10px 20px 10px 20px;
  gap: 20px;
  overflow-x: auto;
  max-width: 100%;
  box-sizing: border-box;
`;
export const PageWrapper = styled.div`
  display: flex;
  align-item: center;
`;
export const PageItem = styled.div`
  display: flex;
  height: 75px;
  width: 75px;
`;
export const PageText = styled.div`
  font-family: Roboto;
  font-size: 12px;
  font-weight: 700;
  line-height: 14.06px;
  text-align: center;
  width: 100%;
  margin-top: 5px;
`;
export const PageTextWrapper = styled.div`
  display: flex;
  align-items: center;
`;

export const MenuWrapper = styled.div`
  width: 95px;
  @media (max-width: 724px) {
    width: 100%;
    display: flex;
    z-index: 102;
    position: relative;
  }
`;

export const ActionsBg = styled.div`
  display: none;
  @media (max-width: 724px) {
    position: fixed;
    display: block;
    left: 0px;
    bottom: 78px;
    width: 100%;
    height: 100%;
    background: #00000066;
    z-index: 1;
  }
`;
export const ActionsWrapper = styled.div`
  flex: 1;
  padding: 8px;
  width: 240px;
  @media (max-width: 724px) {
    position: fixed;
    left: 0px;
    bottom: 78px;
    width: 100%;
    max-height: 78vh;
    background: #fff;
    z-index: 101;
    box-shadow: 2px -32px 30px rgba(0, 0, 0, 0.12);
    border-bottom: 1px solid #d3d3d3;
    border-radius: 20px 20px 0px 0px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    padding-bottom: 20px;
    z-index: 104;
  }
`;

export const MenuItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px;
  gap: 10px;
  border-left: 5px solid #fff;
  cursor: pointer;

  &.active {
    border-left: 5px solid ${(props) => props.theme.colors.primaryColor} !important;
    background-color: ${(props) =>
      props.theme.colors.secondaryColor} !important;

    > * {
      color: ${(props) => props.theme.colors.primaryColor} !important;

      svg path {
        fill: ${(props) => props.theme.colors.primaryColor} !important;
      }
      svg .bg-rect {
        stroke: ${(props) => props.theme.colors.primaryColor} !important;
      }
    }
  }
  @media (max-width: 724px) {
    width: 100%;
    min-width: 75px;

    &.active {
      border-bottom: 2px solid ${(props) => props.theme.colors.primaryColor} !important;
      border-left: none !important;
    }
    background-color: #ffffff;
  }
`;
export const MenuIcon = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 21px;
  height: 21px;
`;
export const MenuText = styled.div`
  font-family: Roboto;
  font-size: 12px;
  font-weight: 700;
  line-height: 14.41px;
  text-align: center;
`;
export const ScrollContainer = styled.div`
  white-space: nowrap;
  width: calc(100vw - 95px);
  &.extended {
    width: calc(100vw - 333px);
  }

  &::-webkit-scrollbar {
    height: 0px !important; /* Width of the scrollbar */
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1 !important; /* Track color */
  }

  &::-webkit-scrollbar-thumb {
    background: #888 !important; /* Scrollbar color */
    border-radius: 10px !important; /* Scrollbar rounded corners */
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #555 !important; /* Scrollbar color on hover */
  }
`;

export const ScrollItem = styled.div`
  display: inline-block;
  width: ${(props) => (props.width ? props.width : "auto")};
  margin: 10px;
  cursor: pointer;
  &.active {
    border: 3px solid #4084b5;
    border-radius: 1px;
  }
`;

export const PreviewItem = styled.div`
  display: inline-block;
  width: ${(props) => (props.width ? props.width : "auto")};
  margin: 10px;
  margin-left: 14px;
  cursor: pointer;
  border: 1px solid #ccc;
  &.active {
    border: 2px solid ${theme.colors.primaryColor};
    border-radius: 1px;
  }
`;

export const ActionTitle = styled.div`
  font-family: Roboto;
  font-size: 20px;
  font-weight: 700;
  line-height: 23.44px;
  text-align: center;
  color: #000;
`;
export const ActionInnerTitle = styled.div`
  font-family: Roboto;
  font-size: ${(props) => (props.fontsize ? props.fontsize : "16px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "600")};
  line-height: ${(props) => (props.lineheight ? props.lineheight : "18.75px")};
  text-align: ${(props) => (props.textalign ? props.textalign : "left")};
  color: ${(props) => (props.color ? props.color : "#232323")};
`;
export const IconButtonBox = styled.div`
  width: ${(props) => (props.width ? props.width : "auto")};
  height: ${(props) => (props.height ? props.height : "34px")};
  background-color: ${(props) => (props.bgcolor ? props.bgcolor : "#fff")};
  padding: ${(props) => (props.padding ? props.padding : "2px")};
  border-radius: 10px;
  display: flex;
  aligin-items: center;
  justify-content: space-between;
`;
export const IconButton = styled.div`
  padding: 0px 16px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  &.active {
    background-color: #eff8ff;
    & svg path {
      fill: #4084b5;
    }
  }
`;

export const StickerShapeIcon = styled.div`
  padding: 0px 16px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  @media (max-width: 724px) {
    padding: 0px 0px !important;
    grid-gap: 4px;
  }
  &.active {
    background-color: #eff8ff;
    & svg path {
      fill: #4084b5;
    }
  }
`;

export const ActionWrapperBox = styled.div`
  width: ${(props) => (props.width ? props.width : "auto")};
  min-height: ${(props) => (props.height ? props.height : "34px")};
  background-color: ${(props) => (props.bgcolor ? props.bgcolor : "#fff")};
  padding: ${(props) => (props.padding ? props.padding : "2px")};
  border-radius: 10px;
  display: flex;
  aligin-items: center;
  justify-content: space-between;
`;

export const ZoomButtonBox = styled.div`
  background-color: #fff;
  padding: 10px;
  border-radius: 10px;
  display: flex;
  aligin-items: center;
  justify-content: space-between;
`;

export const PaginationButton = styled.div`
  background-color: #fff;
  padding: ${(props) => (props.padding ? props.padding : "5px 20px")};
  display: flex;
  aligin-items: center;
  cursor: pointer;
  justify-content: space-between;
`;

export const TopActionBox = styled.div`
  background-color: #fff;
  padding: ${(props) => (props.padding ? props.padding : "5px 20px")};
  display: flex;
  aligin-items: center;
  justify-content: space-between;
`;

export const AddPageButton = styled.div`
  padding: 5px 5px 5px 5px;
  font-family: Roboto;
  font-size: 16px;
  font-weight: 500;
  line-height: 16.44px;
  text-align: center;
  cursor: pointer;
`;

export const ButtonComponent = styled.div`
  background-color: ${(props) => (props.bgcolor ? props.bgcolor : "#F3F3F3")};
  padding: ${(props) => (props.padding ? props.padding : "8px 10px 8px 10px")};
  margin-bottom: ${(props) => (props.mb ? props.mb : null)};
  margin-left: ${(props) => (props.ml ? props.ml : null)};
  margin-right: ${(props) => (props.mr ? props.mr : null)};
  margin-top: ${(props) => (props.mt ? props.mt : null)};
  padding-top: ${(props) => (props.pt ? props.pt : null)};
  padding-bottom: ${(props) => (props.pb ? props.pb : null)};
  padding-left: ${(props) => (props.pl ? props.pl : null)};
  padding-right: ${(props) => (props.pr ? props.pr : null)};
  border-radius: ${(props) => (props.rounded ? props.rounded : "10px")};
  font-family: Roboto;
  font-size: ${(props) => (props.fontsize ? props.fontsize : "14px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "700")};
  line-height: 16.41px;
  text-align: center;
  cursor: pointer;
  color: ${(props) => (props.color ? props.color : "#696969")};
`;

export const ThumbsBox = styled.div`
  width: 50px;
  height: 26px;
  padding: 1px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #f3f3f3;
`;
export const ThumbsIcon = styled.div`
  width: 24px;
  height: 24px;
  padding: 3px 3.01px 4px 4px;
  border-radius: 10px 0px 0px 10px;
  display: flex;
  aligin-items: center;
  &:hover {
    background-color: #fff;
  }
`;
export const HighLightTex = styled.div`
padding:${(props) => (props.padding ? props.padding : "5px 17px 5px 17px")} ;
gap: 10px;
opacity: 0px;
background-color:#EFF8FF;
font-family: Roboto;
font-size: 10px;
font-weight: 700;
line-height: 11.72px;
text-align: center;
color: #232323;

& .colored{
color:#4084B5;
}
}
`;

export const EmptyPhotoWrapper = styled.div`
  border-radius: 10px;
  border: 1px dashed #d3d3d3;
  opacity: 0px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 115px 0px;
`;
export const PhotoItem = styled.img`
  height: 100%;
  width: 100%;
  object-fit: cover;
  object-position: center;
  border-radius: 5px;
  position: relative;
  margin: 5px;

  &.selected {
    border: 1px solid #4084b5;

    &::before {
      content: "";
      position: absolute;
      top: 10px;
      left: 10px;
    }
  }
`;
export const PhotoWrapper = styled.div`
  position: relative;
  height: auto;
  width: calc(45%); /* Two images per row, with a 10px gap */
  margin: 5px 0; /* Vertical margin between rows */
`;
export const PhotoGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px; /* Space between items */
  justify-content: center; /* Align items at the start */
`;

export const FavoriteButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  z-index: 1;
  color: red;
  font-size: 14px;
  background: white;
  border-radius: 100%;

  &:hover {
    color: darkred;
  }
  @media (max-width: 724px) {
    width: 30px;
    height: 30px;
  }
`;

export const DeleteButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  z-index: 1;
  color: red;
  font-size: 14px;
  background: white;
  border-radius: 100%;
  &:hover {
    color: black;
  }
  @media (max-width: 724px) {
    width: 30px;
    height: 30px;
  }
`;

export const ButtonContainer = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  padding: 5px;
  box-sizing: border-box;
`;

export const ImageButtonContainer = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
  display: flex;
  align-items: end;
  padding: 1px;
  box-sizing: border-box;
  gap: 3px;
`;

export const FlexBox = styled.div`
  width: ${(props) => (props.width ? props.width : "")};
  margin-bottom: ${(props) => (props.mb ? props.mb : null)};
  margin-left: ${(props) => (props.ml ? props.ml : null)};
  margin-right: ${(props) => (props.mr ? props.mr : null)};
  margin-top: ${(props) => (props.mt ? props.mt : null)};
  padding-top: ${(props) => (props.pt ? props.pt : null)};
  padding-bottom: ${(props) => (props.pb ? props.pb : null)};
  padding-left: ${(props) => (props.pl ? props.pl : null)};
  padding-right: ${(props) => (props.pr ? props.pr : null)};
  display: flex;
  flex-direction: ${(props) => (props.direction ? props.direction : "row")};
  align-items: ${(props) => (props.alignitems ? props.alignitems : "center")};
  justify-content: ${(props) => (props.justify ? props.justify : "start")};
  gap: ${(props) => (props.gap ? props.gap : "0px")};
  flex-wrap: ${(props) => (props.wrap ? props.wrap : "wrap")};
  flex-grow: ${(props) => (props.grow ? props.grow : "auto")};
  @media (max-width: 724px) {
    &.mob_heading_flex {
      justify-content: start;
    }
    &.mask-items-center {
      justify-content: center;
    }
  }
`;
export const LayoutPageItem = styled.img`
  width: ${(props) => (props.width ? props.width : "100px")};
  height:${(props) => (props.height ? props.height : "100px")};
 
  object-fit: contain; 
  object-position: center;
  box-shadow: 0px 0px 3px 0px #00000026;
  border:1px solid #00000026;
  position: relative; 
  margin:5px;
  }
`;
export const LayoutSpreadItem = styled.img`
  height: 122px;
  width: 211px;
  object-fit: contain; 
  object-position: center;
  box-shadow: 0px 0px 3px 0px #00000026;
  border:1px solid #00000026;
  position: relative; 
  margin:5px;
  }
`;
export const LayoutPaginationBox = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 15px;
  margin-bottom: 15px;
`;
export const LayoutPaginationItem = styled.div`
  font-family: Roboto;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background-color: #f6f6f6;
  border: 1px solid #f6f6f6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #000;
  &.active {
    border: 1px solid ${(props) => props.theme.colors.primaryColor};
    color: ${(props) => props.theme.colors.primaryColor};
  }
`;
export const BackgroundColorItem = styled.div`
  width: 37px;
  height: 37px;
  border-radius: 5px;
  background: ${(props) =>
    props.bgimage
      ? `url(${props.bgimage}) no-repeat center center / cover`
      : props.bgcolor || "transparent"};
  cursor: pointer;
`;
export const BackgroundColorItemSmall = styled.div`
  width: 25px;
  height: 25px;
  border-radius: 5px;
  background: ${(props) =>
    props.bgimage
      ? `url(${props.bgimage}) no-repeat center center / cover`
      : props.bgcolor || "transparent"};
  cursor: pointer;
`;

export const ColorPickerBox = styled.div`
  width: 37px;
  height: 37px;
  border-radius: 5px;
  background: ${(props) =>
    props.bgimage
      ? `url(${props.bgimage}) no-repeat center center / cover`
      : props.bgcolor || "transparent"};
  cursor: pointer;
`;

export const BackgroundImageItem = styled.img`
  width: 62.79px;
  height: 62.79px;
  border-radius: 5px;
  object-fit: contain;
  object-position: center;
  box-shadow: 0px 0px 3px 0px #00000026;
  position: relative;
  margin: 5px;
`;

export const StickerItem = styled.div`
  width: 65px;
  height: 55px;
  border-radius: 5px;
  background-color: #f2f2f2;
  padding: 5px;
  & img {
    object-fit: contain;
    object-position: center;
    width: 100%;
    height: 100%;
  }
`;

export const BackgroundItem = styled.div`
  width: 65px;
  height: 55px;
  border-radius: 5px;
  background-color: #f2f2f2;
  padding: 5px;
  & img {
    object-fit: contain;
    object-position: center;
    width: 100%;
    height: 100%;
  }
`;

export const BackgroundImage = styled.img`
  width: 95px;
  height: 95px;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.1s ease, opacity 0.1s ease-out;
  display: block;
  transition: box-shadow 0.3s ease;

  &:hover {
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2);
  }
`;

export const SearchBox = styled.div`
position:relative;
& .search-icon{
position:absolute;
top:3px;
left:8px;
cursor:pointer;
}
& .filter-icon{
position:absolute;
top:3px;
cursor:pointer;
right:8px;
}
}
`;
export const SearchInput = styled.input`
    width: 100%;
    background: #F9F9F9;
    height: 30px;
    border-radius: 10px;
    border: none;
    padding: 5px 30px;
&::placeholder{
color:#ADADAD;
font-family: Roboto;
font-size: 12px;
font-weight: 400;
line-height: 14.06px;
text-align: left;
}
}
`;
export const StyledTabs = styled(Tabs)`
  background-color: #f0f0f0;
  border-radius: 5px;
  &.nav-tabs {
    justify-content: space-between;
  }
  & .nav-item:first-child .nav-link {
    margin-left: 5px !important;
  }
  & .nav-link {
    color: #000;
    border-radius: 5px;
    font-family: Roboto;
    font-size: 11px;
    font-weight: 500;
    line-height: 10px !important;
    text-align: center;
    padding: 5px 5px;
    margin-top: 5px;
    margin-bottom: 5px;
    &:hover {
      background-color: #fff;
    }
    &.active {
      background-color: #fff;
      color: #000;
    }
  }
`;

export const CollapseButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 34px;
  margin-bottom: 10px;
  background-color: ${(props) => (props.bgcolor ? props.bgcolor : "#EFF8FF")};
  border-color: #eff8ff;
  color: #000;
  padding-top: ${(props) => (props.pt ? props.pt : "5px")};
  padding-bottom: ${(props) => (props.pb ? props.pb : "5px")};
  padding-left: ${(props) => (props.pl ? props.pl : "14px")};
  padding-right: ${(props) => (props.pr ? props.pr : "14px")};
  font-family: Roboto;
  font-size: 14px;
  font-weight: 500;
  line-height: 16.41px;
  text-align: left;
  border-radius: 0px;
  cursor: pointer;
`;

export const StyledCollapse = styled(Collapse)`
  background-color: #eff8ff;
  padding: 8px;
  margin-bottom: 10px;
  &:last-child {
    margin-bottom: 0px;
  }
`;

export const ThemeItem = styled.img`
  width: 63px;
  height: 63px;
  border-radius: 5px;
  object-fit: cover;
  object-position: center;
  box-shadow: 0px 0px 10px 0px #0000001f;
  position: relative;
`;

export const ThemeTitle = styled.div`
  font-family: Roboto;
  font-size: 10px;
  font-weight: 500;
  line-height: 11.72px;
  text-align: center;
  color: #000;
`;

export const FrameItem = styled.img`
  width: 62px;
  height: 62px;
  object-fit: cover;
  object-position: center;
`;
export const MaskItem = styled.img`
  width: 63px;
  height: 63px;
  object-fit: cover;
  object-position: center;
`;

export const TextLabel = styled.label`
  font-family: Roboto;
  font-size: 14px;
  font-weight: 400;
  line-height: 15px;
  text-align: left;
  color: #232323;
`;

export const TextSelect = styled(Form.Select)`
  width: ${(props) => (props.width ? props.width : "100%")};
  height: 32px;
  padding: 6px 15px 6px 15px;
  border-radius: 5px;
  border-color: #f9f9f9;
  background-color: #f9f9f9;
  font-family: Roboto;
  font-size: 14px;
  font-weight: 500;
  line-height: 15px;
  text-align: left;
  color: #232323;
  &:focus {
    box-shadow: 0 0 0 0.15rem rgb(64 132 181 / 39%);
  }
`;
export const TextAlignButton = styled.div`
  width: 40px;
  height: 40px;
  padding: 10.67px 9.33px 10.79px 8px;
  border-radius: 5px;
  background: #f9f9f9;
  display: flex;
  align-items: center;
  justify-content: center;
  &.active {
    background: #d3d3d3;
  }
`;

export const PhotoModalStyled = styled(Modal)`
  .modal-content {
    background-color: #fff;
    border-radius: 0px;
  }

  @media (max-width: 724px) {
    .modal-content {
      width: 100%;
      margin: 0px;
      border: none;
      max-height: calc(100vh - 100px);
      border-radius: 20px 20px 0px 0px;
    }

    .modal-dialog {
      width: 100%;
      margin: 0px;
      margin-top: auto;
      animation: fadeInUp 0.5s ease-in-out;
    }

    @keyframes fadeInUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  }
`;

export const PhotoModalHeader = styled(Modal.Header)`
  background-color: #eff8ff;
  height: 62px;
  padding: 17px 28px 17px 83px;
  border-bottom: none;
  justify-content: end;
  @media (max-width: 724px) {
    padding: 0px 5px 0px 10px;
    flex-direction: row-reverse;
    background-color: transparent;
  }
`;

export const PhotoModalBody = styled(Modal.Body)`
  padding: 0px;
  display: flex;
  & .side-bar {
    width: 138px;
    background: #f9f9f9;
    box-shadow: 4px 0px 10px 0px #0000001f;
    padding: 24px 0px;
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
    gap: 30px;
  }
  & .modal-body-main-content {
    flex-grow: 1;
    padding: 20px;
    background-color: rgb(255, 255, 255) !important;
    position: relative;
  }
  @media (max-width: 724px) {
    display: grid;
    grid-template-rows: 70px 1fr;
    padding: 10px;
    & .side-bar {
      flex-direction: row;
      width: 100%;
      box-shadow: none;
    }
    & .modal-body-main-content {
      overflow-x: auto;
    }
  }
`;

export const PhotoOptionItem = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  & .title {
    font-family: Roboto;
    font-size: 14px;
    font-weight: 600;
    line-height: 16.41px;
    text-align: center;
    color: #696969;
    margin-top: 10px;
  }
  & svg {
    width: 30px;
    height: 30px;
  }
  &.active .title {
    color: #232323;
  }
  &.active svg path {
    fill: #232323;
  }
  &.active svg path.has-stroke {
    fill: #ffffff00 !important;
    stroke: #232323 !important;
  }
  @media (max-width: 724px) {
    &.photo_box_modal {
      width: 100%;
    }

    &.photo_box_modal svg {
      width: 20px;
      height: 20px;
    }

    &.photo_box_modal span {
      font-size: 10px;
    }
  }
`;
export const TitleMd = styled.div`
  font-family: Roboto;
  font-size: ${(props) => (props.fontsize ? props.fontsize : "28px")};
  font-weight: 500;
  line-height: 32.81px;
  text-align: ${(props) => (props.align ? props.align : "left")};
  color: ${(props) => (props.color ? props.color : "#232323")};
`;

export const Title20 = styled.div`
  font-family: Roboto;
  font-size: ${(props) => (props.fontsize ? props.fontsize : "20px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "500")};
  line-height: 23.44px;
  text-align: ${(props) => (props.align ? props.align : "left")};
  color: ${(props) => (props.color ? props.color : "#232323")};
`;

export const FromMobileWrapper = styled.div`
  width: 100%;
  padding: 10px;
  gap: 33px;
  border-radius: 10px;
  border: 1px dashed #d3d3d3;
`;

export const DateCheckbox = styled.div`
  .form-check-input:checked {
    background-color: ${(props) => props.theme.colors.primaryColor};
    border-color: ${(props) => props.theme.colors.primaryColor};
    border-radius: 50%;
  }

  .form-check-input {
    border-radius: 50%;
  }

  .form-check-label {
    cursor: pointer;
    font-family: Roboto;
    font-size: 14px;
    font-weight: 500;
    line-height: 16.75px;
    text-align: left;
    color: #232323;
  }
`;
export const AddMyPhotoItem = styled.div`
  margin-top: 10px;
  .image-box {
    position: relative;
    cursor: pointer;
    display: inline-block;
  }

  .image-box::after {
    content: "\\2714";
    position: absolute;
    top: 7px;
    left: 7px;
    height: 16px;
    width: 16px;
    padding: 7px;
    border-radius: 50%;
    background-color: ${(props) => props.theme.colors.primaryColor};
    display: none;
  }

  &.active .image-box::after {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #fff;
  }

  .image-box img {
    height: 80px;
    width: 80px;
    object-position: center;
    object-fit: cover;
  }

  .image-box .overlay {
    position: absolute;
    inset: 0;
    background: #00000080;
    display: none;
  }

  &.active .image-box .overlay {
    display: block;
  }
`;

export const AddMyPhotoBox = styled.div`
  padding-left: 60px;
  padding-top: 20px;
  margin-top: -20px;
  margin-right: -18px;
  height: calc(100vh - 140px);
  overflow-y: auto;
  &.seleted-visible {
    padding-bottom: 100px;
  }
  @media (max-width: 724px) {
    &.add-photo-box {
      padding-left: 0px;
      height: 0vh;
    }
  }
`;
export const SelectedPhotoBox = styled.div`
  padding: 10px 20px;
  box-shadow: 0px -4px 3px 0px #0000001f;
  position: absolute;
  bottom: 0px;
  left: 0px;
  right: 0px;
  background-color: #fff;
  img {
    height: 60px;
    width: 60px;
  }
`;
export const ScrollButton = styled.button`
  position: absolute;
  top: 66%;
  transform: translateY(-50%);
  background: #fff;
  border: none;
  color: #232323;
  cursor: pointer;
  border-radius: 50%;
  height: 28px;
  width: 28px;
  z-index: 10;
  text-align: center;
  box-shadow: 0px 0px 5px 0px #000000b3;
  display: ${({ show }) => (show ? "block" : "none")};
  ${({ side }) => (side === "left" ? "left:6px;" : "right: 6px;")}
`;

export const ImportSocialButton = styled(Button)`
  font-family: Roboto;
  line-height: 28.13px;
  text-align: center;
  font-size: ${(props) => (props.fontsize ? props.fontsize : "20px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "600")};
  background-color: ${(props) =>
    props.bgcolor ? props.bgcolor : props.theme.colors.primaryColor};
  border: none;
  border-radius: ${(props) => (props.radius ? props.radius : "5px")};
  color: ${(props) => (props.textcolor ? props.textcolor : "#fff")};
  padding-top: ${(props) => (props.pt ? props.pt : "10px")};
  padding-bottom: ${(props) => (props.pb ? props.pb : "10px")};
  padding-left: ${(props) => (props.pl ? props.pl : "16px")};
  padding-right: ${(props) => (props.pr ? props.pr : "16px")};
  margin-top: ${(props) => (props.mt ? props.mt : "0px")};
  margin-bottom: ${(props) => (props.mb ? props.mb : "0px")};
  margin-left: ${(props) => (props.ml ? props.ml : "0px")};
  margin-right: ${(props) => (props.mr ? props.mr : "0px")};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  &:hover {
    background-color: ${(props) =>
      props.bgcolor ? props.bgcolor : props.theme.colors.primaryColor};
    color: ${(props) => (props.textcolor ? props.textcolor : "#fff")};
  }
`;

export const UploadQueueBox = styled.div`
  padding-left: 5px;
  padding-right: 5px;
  padding-top: 5px;
  margin-top: -5px;

  // height: calc(100vh - 140px);
  overflow-y: auto;
  @media (max-width: 724px) {
    &.upload-queue-box {
    }
  }
`;

export const ProgressBarWrapper = styled.div`
  display: flex;
  align-items: center;
  .progress {
    flex-grow: 1;
    margin-right: 10px;
    height: 10px;
    width: 120px;
    border-radius: 10px;
  }
  .progress-bar {
    background: #66b49d;
  }
  .progress-label {
    white-space: nowrap;
    color: #66b49d;
  }
`;

export const Dragger = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 1500px;
  height: 1500px;
  background-color: #b5aaaa;
  border-radius: 50%;
  cursor: grab;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;

  & .icon {
  }
`;

export const FlipBookContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
`;

export const FlipBookPages = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f0f0f0;
  width: 100%;
  height: 100%;
  font-size: 20px;
  color: #333;
`;

export const PhotoModalBodyStyled = styled.div`
  overflow: hidden;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 20px;
`;

export const PreviewItemDropIndicator = styled.div`
  width: 4px; // Set width for the vertical line
  height: 100%; // Set the height to match the PreviewItem
  background-color: #007bff; // Color for the drop indicator
  position: absolute; // Position it absolutely
  right: 0; // Position it on the right side

  top: 0; // Align it to the top of the parent
  display: ${(props) => (props.visible ? "block" : "none")};
`;

export const PreviewItemAddPage = styled.div`
  display: flex;
  align-items: center;
`;

export const LeftPage = styled.div`
 
  width: ${(props) => (props.width ? props.width : "50%")};
  position: absolute;
  border: ${(props) => (props.border ? props.border : "50%")} solid #008fff;
  height: 100%;
  top: -100%;
  }
`;
export const RightPage = styled.div`
 
  width: ${(props) => (props.width ? props.width : "50%")};
  position: absolute;
  right: 0;
  border: 1px solid #008fff;
  height: 100%;
  top: -100%;

  }
`;
