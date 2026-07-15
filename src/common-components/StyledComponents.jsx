import styled, { keyframes } from "styled-components";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import { createGlobalStyle } from "styled-components";
import eyeIcon from "../assets/icons/eye_icon.svg";
import { Collapse, Tab, Tabs } from "react-bootstrap";
import Form from "react-bootstrap/Form";

export const theme = {
  colors: {
    primaryColor: "#111111",
    secondaryColor: "#f0f0f0",
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
    user-select: none;
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
  background: var(--primary);
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
    height: auto !important
    }
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
    min-height: calc(100vh - 211px) !important;
    overflow-x: hidden;
    overflow-y: auto;
}

.sticker-container {

  height: calc(100vh - 110px);
  max-height: calc(100vh - 110px); /* 100vh minus the height of the header */
  overflow-y: auto; /* Enable vertical scrolling when content exceeds the height */
}
.photo-container
{
 min-height: 50vh;
 max-height: calc(100vh - 120px);
 overflow-y: auto;
}
.sticker-item {
  transition: transform 0.3s, box-shadow 0.3s; /* Smooth transition */
}
  
.sticker-item:hover {
  transform: scale(1.1); /* Slightly scale the sticker on hover */
}
.sticker-pagination {
  
}
.sticker-item-block{
  // background: #f4f3f3;
  padding: 0.2em;
  border-radius: 8px;
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
  border: 1px solid #111111;
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
  background-color: #111111;
  box-shadow: inset 0 0 0 4px #fff; 
}
.radio input[type="radio"]:focus + .radio-label:before {
  outline: none;
  border-color: #111111; 
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
  color: var(--foreground); 
  background-color: #fff; 
  border-radius: 50%;
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
    border-top: 2px solid var(--primary);
    border-bottom: 2px solid var(--primary);
    border-left: 2px solid var(--primary);
}

.selected-right {
    border-top: 2px solid var(--primary);
    border-bottom: 2px solid var(--primary);
    border-right: 2px solid var(--primary);
}
.leftSide:before {
  
}
.rightSide:before {
}
.WrapperDiv {
    overflow: hidden;
    transition: none !important;
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
  .WrapperDivLineForLayflat{
    &::after {
    content: ""; /* Ensure the pseudo-element is generated */
    position: absolute;
    z-index: 10;
    top: 0;
    bottom: 0;
    left: 50%;
    border-left: 2px solid rgb(243, 243, 243);
    transform: translateX(-50%); 
    // box-shadow: 0 0 15px 1px rgba(0, 0, 0, 0.5);
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
 fill:#111111;
  transform: scale(1.6); /* Slightly scale the sticker on hover */
}

.photo-item{
  height: 100%;
  width: 100%;
  object-fit: cover; 
  object-position: center;
  border-radius: 5px; 
  position: relative; 
  margin:5px;
  cursor: pointer;

  &.selected {
    border: 1px solid #111111; 

    &::before { 
      content: '';
      position: absolute;
      top: 10px;
      left: 10px;
    }
  }
}
.photo-item-loader{
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  background-color: rgba(0,0,0,0.1);
}
.page-loader{
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  position: absolute;
  top:20px;

}
  .page-loader-spinner{
   position: relative;
   z-index: 10;
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

.page-link{
  font-size:14px !important;
  padding:5px 8px !important;
}
  @media(max-width:730px)
  {
  .page-link{
  font-size:16px !important;
  padding:5px 10px !important;
}
  }

.btn.disabled, .btn:disabled {
    background-color:#E4E4E4 !important;
    // border-color: #cccccc !important;
    color: #666666 !important;
    cursor: not-allowed !important;
}
    .theme-box-shadow{
    box-shadow: rgba(0, 0, 0, 0.19) 0px 0px 8px, rgba(0, 0, 0, 0.18) 0px 0px 8px;

 //scale size of object controls in small screen
 .rCS1w3zcxh .moveable-control{
  @media (max-width: 768px) {
 position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-sizing: border-box;
    background: #111111;
    margin-top: -10px;
    margin-left: -10px;
    z-index: 10;
  }
}
}

//index.css file
.relative-color-picker {
  position: relative;
  width: 100%;
}
.sketch-picker {
  max-width: 200px !important;
  width: 100% !important;
}
.google-photo-container {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex-direction: column;
  max-height: 50vh;
  overflow-y: auto;
}
.social-photos-get {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  grid-gap: 20px;
  width: 100%;
}
.social-photos-get img {
  width: 150px;
  object-fit: cover;
  object-position: center;
  border-radius: 5px;
}
.spinner {
  border: 2px solid #f3f3f3;
  border-top: 2px solid #4285f4;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
}
.google-login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0px 20px;
  height: 50px;
  background-color: #ffffff;
  color: #333333;
  border: 1px solid #e6e6e6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  gap: 8px;
  width: 100%;
  margin-top: 10px;
  max-width: 600px;
}
.error-no-img {
  color: red;
  margin-top: 20px;
}
.google-photo-container h1 {
  font-size: 1rem;
  color: #4d4d4d;
  font-weight: 500;
  margin-top: 10px;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
@media (max-width: 724px) {
  .modal.show {
    display: flex !important;
    overflow-y: hidden;
    width: 100% !important;
    max-width: 100% !important;
    padding-left: 0px !important;
  }
  .social-photos-get {
    justify-content: center;
  }

  .google-photo-container h1 {
    font-size: 1.6rem;
  }
  .social-photos-get {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
  }
  .social-photos-get img {
    width: 100%;
  }
  .modal.fade .modal-dialog {
    transition: none !important;
  }

  .mob_full_screen_modal {
    width: 100% !important;
    max-width: 100% !important;
  }

  .scroll-container-mob {
    overflow-y: auto;
    width: 100%;
    overflow-x: hidden;
    padding: 0px 8px;
  }

  .sticker-container-mob {
    display: grid;
    grid-template-rows: 40px 1fr;
    z-index: 11000;
    width: 100%;
    height: 35vh;
    max-height: 35vh;
    overflow: auto;
    margin-top: 0px !important;
    padding-left: 0px !important;
    padding-right: 0px !important;
  }

  .sticker-container-mob.mt-3 {
    margin-top: 0px !important;
  }

  .sticker-container-mob .heading-action-mob {
    padding: 0px 8px 3px 8px;
  }

  .img-fluid-sticker {
    object-fit: contain;
  }

  .sticker-demo-icons {
    height: 20px;
    margin-right: 0px !important;
  }

  .sticker-demo-icons.me-2 {
    margin-right: 0px !important;
  }

  .text-caption-box-mob.text-caption-box {
    height: auto !important;
  }

  .mask-items-center {
    justify-content: center;
  }

  .hidden-canvas-btns-mob {
    display: none !important;
  }

  .canvas-bottom-mob {
    /* display: grid !important; */
    /* grid-template-columns: 1fr 1fr 1fr !important; */
  }

  .page-number-p-mob {
    padding: 5px 10px !important;
  }

  .page-number-p-mob .body-text-pagination {
    text-align: center !important;
    font-size: 12px;
  }

  .pagination-btn-mob {
    padding: 5px 10px !important;
  }

  .zoom-value-mob.ms-3 {
    margin-right: 5px !important;
  }

  .zoom-value-mob.me-4 {
    margin-left: 5px !important;
  }

  .photo-img-cover-mob {
    object-fit: cover !important;
  }

  .add-photo-proj-mob {
    padding-top: 0px !important;
    padding-bottom: 0px !important;
  }

  .center-photo-upload-box-mob {
    display: flex;
    justify-content: center !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
  }

  .photo-mob-flexbox {
    padding-top: 0px !important;
  }

  .layout-svg-mob {
    margin: 5px 0px !important;
    width: 100% !important;
  }

  .color-picker-mob-dialog {
    position: absolute !important;
    right: 0px;
    bottom: 0px;
  }
}
@media (max-width: 1350px) {
  .header-icon-container-mob {
    overflow-x: auto !important;
  }

  .header-dropdown-mob {
    position: static !important;
  }

  .header-grid-mob {
    flex-wrap: nowrap !important;
  }
}

@media (max-width: 1320px) {
  .btn-light-mob span {
    display: none !important;
  }
}
@media (max-width: 400px) {
  .social-photos-get {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 315px) {
  .canvas-bottom-mob {
    /* grid-template-columns: 1fr !important; */
  }
}

@media (max-width: 900px) {
  .popover-container-mob {
    flex-wrap: wrap;
    z-index: 1000;
  }

  .popover-container-mob.justify-content-between {
    justify-content: center !important;
  }

  .popover-container-mob svg {
    height: 20px !important;
  }

  .popover-container-mob .name {
    font-size: 14px !important;
  }

  .popover-container-mob .dash-popup {
    display: none !important;
  }
}


//wall preivew css
.calender-container {
  box-shadow: 8px 8px 2px rgba(0, 0, 0, 0.15), 0px 3px 6px rgba(0, 0, 0, 0.1);
  height: max-content;
  transition: box-shadow 0.5s ease;
}

.acrylic-container {
  box-shadow: 5px 5px 2px rgba(0, 0, 0, 0.15), 0px 3px 6px rgba(0, 0, 0, 0.1);
  height: max-content;
  transition: box-shadow 0.5s ease;
}


`;

export const HeaderWrapper = styled.div`
  width: 100%;
  height: 69px;
  background-color: #fff !important;
  padding: 10px 25px;
  box-shadow: 0px 4px 4px 0px #0000001f;
  display: flex;
  flex-direction: column;
  justify-content: center;
  @media (max-width: 310px) {
    padding: 10px 5px;
  }
`;
export const BrandTitle = styled.div`
font-family: Archivo Black;
font-size: 2.2rem;
font-weight: 400;
line-height: 2.3rem;
text-align: left;
color: var(--primary);
@media(max-width:724px){
  display: none;
}
}

`;
export const BrandLogo = styled.img`
  height: 2.5rem; /* Fix spelling from "hight" to "height" */
  width: 5rem;
  object-fit: contain; /* Uncomment this to maintain the aspect ratio */
  display: block; /* Ensure no extra spacing below the image */
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
    border-color: var(--primary);
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
  @media (max-width: 1024px) {
    flex-wrap: wrap;
    grid-gap: 10px;
    &.top-action-mob {
      grid-gap: 5px 0px;
    }
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
  @media (max-width: 1024px) {
    grid-gap: 10px;
  }
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
  padding: ${(props) => (props.p ? props.p : null)};
  cursor: ${(props) => (props.cursor ? props.cursor : null)};
  width: ${(props) => (props.width ? props.width : null)};
  opacity: ${(props) => (props.opacity ? props.opacity : 1)};
  border-radius: ${(props) => (props?.br ? props?.br : null)};
  background-color: ${(props) =>
    props?.bgColor ? props?.bgColor : "transparent"};
  padding: ${(props) => (props.p ? props.p : "1px")};

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
  color: ${(props) => (props.color ? props.color : "var(--foreground)")};
  position: relative;
  margin-bottom: ${(props) => (props.mb ? props.mb : "0px")};
  margin-top: ${(props) => (props.mt ? props.mt : "0px")};
`;
export const BodyText = styled.div.withConfig({
  shouldForwardProp: (prop) => !['fontsize', 'fontweight', 'lineheight', 'textcolor', 'mt', 'mb', 'ml', 'mr', 'textAlign', 'pl', 'pr', 'pt', 'pb', 'display'].includes(prop)
})`
  font-size: ${(props) => (props.fontsize ? props.fontsize : "14px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "400")};
  line-height: ${(props) => (props.lineheight ? props.lineheight : "1.5")};
  color: ${(props) => (props.textcolor ? props.textcolor : "var(--muted-foreground)")};
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
  width: ${(props) => (props.width ? props.width : "")};
  font-size: ${(props) => (props.fontsize ? props.fontsize : "16px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "500")};
  background-color: var(--primary);
  border: none;
  border-radius: ${(props) => (props.radius ? props.radius : "5px")};
  color: var(--primary-foreground);
  padding-top: ${(props) => (props.pt ? props.pt : "7px")};
  padding-bottom: ${(props) => (props.pb ? props.pb : "7px")};
  padding-left: ${(props) => (props.pl ? props.pl : "16px")};
  padding-right: ${(props) => (props.pr ? props.pr : "16px")};
  margin-top: ${(props) => (props.mt ? props.mt : "0px")};
  margin-bottom: ${(props) => (props.mb ? props.mb : "0px")};
  margin-left: ${(props) => (props.ml ? props.ml : "0px")};
  margin-right: ${(props) => (props.mr ? props.mr : "0px")};
  &:hover {
    background-color: var(--secondary);
    color: var(--secondary-foreground);
  }

  &:active {
    background-color: var(--primary);
    color: var(--primary-foreground);
    border: none !important;
  }
  &:focus-visible {
    background-color: var(--primary) !important;
    color: var(--primary-foreground) !important;
    outline: none !important;
  }

  & span {
    margin-top: 3px;
    margin-left: 7px;
  }

  @media (max-width: 1126px) {
    & span {
      display: none;
    }
    & span.btn-order {
      display: inline;
    }
    padding: 8px 10px;
    & svg {
      height: 18px;
    }
  }
`;
export const PrimaryOutlineButton = styled(Button)`
  font-family: Roboto;
  line-height: 18.75px;
  text-align: center;
  width: ${(props) => (props.width ? props.width : "")};
  font-size: ${(props) => (props.fontsize ? props.fontsize : "16px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "500")};
  background-color: transparent;
  border: 2px solid var(--primary);
  border-radius: ${(props) => (props.radius ? props.radius : "5px")};
  color: var(--primary);
  padding-top: ${(props) => (props.pt ? props.pt : "7px")};
  padding-bottom: ${(props) => (props.pb ? props.pb : "7px")};
  padding-left: ${(props) => (props.pl ? props.pl : "16px")};
  padding-right: ${(props) => (props.pr ? props.pr : "16px")};
  margin-top: ${(props) => (props.mt ? props.mt : "0px")};
  margin-bottom: ${(props) => (props.mb ? props.mb : "0px")};
  margin-left: ${(props) => (props.ml ? props.ml : "0px")};
  margin-right: ${(props) => (props.mr ? props.mr : "0px")};
  transition: all 0.3s ease-in-out;

  &:hover {
    background-color: var(--primary) !important;
    color: var(--primary-foreground) !important;
    border-color: var(--primary) !important;
  }

  &:active {
    background-color: var(--primary);
    color: var(--primary-foreground);
    border-color: transparent !important;
  }
  &:focus-visible {
    background-color: var(--primary) !important;
    color: var(--primary-foreground) !important;
  }

  & span {
    margin-top: 3px;
    margin-left: 7px;
  }

  @media (max-width: 1126px) {
    & span {
      display: none;
    }
    & span.btn-order {
      display: inline;
    }
    padding: 8px 10px;
    & svg {
      height: 18px;
    }
  }
`;

export const LightPrimaryButton = styled(Button)`
  font-family: Roboto, sans-serif;
  text-align: center;
  font-size: ${(props) => props.fontsize || "16px"};
  font-weight: ${(props) => props.fontweight || "500"};
  background-color: var(--secondary);
  color: var(--secondary-foreground);
  display: flex;
  align-items: center;
  border: ${(props) => props.border || "none"};
  border-radius: ${(props) => (props.radius ? props.radius : "5px")};
  padding: ${(props) =>
    `${props.pt || "7px"} ${props.pr || "16px"} ${props.pb || "7px"} ${props.pl || "16px"
    }`};
  margin: ${(props) =>
    `${props.mt || "0px"} ${props.mr || "0px"} ${props.mb || "0px"} ${props.ml || "0px"
    }`};
  transition: all 0.3s ease-in-out;

  &:hover {
    background-color: var(--primary) !important;
    border-color: var(--primary) !important;
    color: var(--primary-foreground) !important;
  }
  &:active {
    background-color: var(--muted) !important;
    color: var(--muted-foreground) !important;
  }
  &:focus-visible {
    background-color: var(--accent) !important;
    color: var(--accent-foreground) !important;
    outline: none !important;
  }

  & span {
    margin-top: 3px;
    margin-left: 7px;
  }

  @media (max-width: 1126px) {
    padding: 8px 10px;
    span {
      display: none;
    }
    & span.btn-save {
      display: inline;
    }
    svg {
      width: 18px;
    }
  }
  // add classes
`;

export const AICaptionItem = styled.div`
  background-color: ${(props) => props.bgcolor || "#fff"};
  padding: ${(props) => props.padding || "8px"};
  border: ${(props) =>
    props.borderColor ? `1px solid ${props.borderColor}` : "1px solid #ddd"};
  border-radius: ${(props) => props.borderRadius || "8px"};
  color: ${(props) => props.textcolor || "#333"};
  box-shadow: ${(props) => props.shadow || "0 4px 8px rgba(0, 0, 0, 0.1)"};
  margin: ${(props) => props.margin || "5px 0"};
  display: flex;
  flex-direction: column;
  align-items: ${(props) => props.align || "flex-start"};
  text-align: ${(props) => props.textAlign || "left"};
  cursor: ${(props) => (props.onClick ? "pointer" : "default")};
  font-size: 14px;
  &:hover {
    box-shadow: ${(props) =>
    props.hoverShadow || "0 6px 12px rgba(0, 0, 0, 0.15)"};
    border: ${(props) => props.hoverBorder || "1px solid #ddd"};
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
  margin: 10px 8px;
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
  // scrollbar-width: thin;
  @media (min-width: 724px) {
    max-height: calc(100vh - 69px);
    overflow-y: auto;
  }
  @media (max-width: 724px) {
    width: 100%;
    display: flex;
    z-index: 102;
    position: relative;
    overflow-y: auto;
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
    background: transparent;
    z-index: 1;
    cursor: pointer;
  }
`;
export const slideInLeft = keyframes`
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
`;

export const slideOutLeft = keyframes`
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
`;

export const ActionsWrapper = styled.div`
  flex: 1;
  padding: 3px;
  width: 240px;
  background: #fff;
  z-index: 1001;

  &.slide-in {
    animation: ${slideInLeft} 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
  }

  &.slide-out {
    animation: ${slideOutLeft} 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
  }

  @media (max-width: 724px) {
    position: fixed;
    left: 0px;
    bottom: 78px;
    width: 100%;
    max-height: 78vh;
    box-shadow: 2px -32px 30px rgba(0, 0, 0, 0.12);
    border-bottom: 1px solid #d3d3d3;
    border-radius: 20px 20px 0px 0px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    padding-bottom: 20px;
    overflow-y: hidden;
    overflow-x: visible;

    &.slide-in {
      animation: none; /* Can add bottom-up slide here later if requested */
    }
    &.slide-out {
      animation: none;
    }
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
    border-left: 5px solid var(--primary) !important;
    background-color: var(--secondary) !important;

    > * {
      color: var(--primary) !important;

      svg path {
        fill: var(--primary) !important;
      }
      svg .bg-rect {
        stroke: var(--primary) !important;
      }
    }
  }
  @media (max-width: 724px) {
    width: 100%;
    min-width: 75px;

    &.active {
      border-bottom: 2px solid var(--primary) !important;
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
  position: relative;
`;
export const MenuBadge = styled.span`
  position: absolute;
  top: -8px;
  right: -10px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--primary);
  color: #fff;
  border-radius: 8px;
  font-family: Roboto;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  box-sizing: border-box;
  pointer-events: none;
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
  display: flex;
  width: calc(100vw - 95px);
  will-change: scroll-position;
  overflow-x: auto;
  overflow-y: hidden;
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
    border: 3px solid var(--primary);
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
    border: 2px solid var(--primary);
    border-radius: 1px;
  }
`;

export const ActionTitle = styled.div`
  font-family: Roboto;
  font-size: 20px;
  font-weight: 700;
  line-height: 23.44px;
  text-align: center;
  color: var(--foreground);
`;
export const ActionInnerTitle = styled.div`
  font-family: Roboto;
  font-size: ${(props) => (props.fontsize ? props.fontsize : "16px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "600")};
  line-height: ${(props) => (props.lineheight ? props.lineheight : "18.75px")};
  text-align: ${(props) => (props.textalign ? props.textalign : "left")};
  color: ${(props) => (props.color ? props.color : "var(--foreground)")};
`;
export const IconButtonBox = styled.div`
  width: ${(props) => (props.width ? props.width : "50px")};
  height: ${(props) => (props.height ? props.height : "34px")};
  background-color: ${(props) => (props.bgcolor ? props.bgcolor : "#fff")};
  padding: ${(props) => (props.padding ? props.padding : "2px")};
  border-radius: 10px;
  display: flex;
  aligin-items: center;
  justify-content: space-between;
`;
export const IconButton = styled.div`
  padding: 0px 14px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  &.active {
    background-color: var(--secondary);
    & svg path:not([fill="none"]) {
      fill: var(--primary);
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
    background-color: var(--secondary);
    & svg path:not([fill="none"]) {
      fill: var(--primary);
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
  background-color: ${(props) =>
    props.backgroundColor ? props.backgroundColor : "#ffffF"};

  padding: 10px;
  border-radius: 10px;
  display: flex;
  aligin-items: center;
  gap: 20px;
  justify-content: space-between;
`;

export const PaginationButton = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'padding'
})`
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
  background-color: ${(props) => (props.bgcolor ? props.bgcolor : "var(--secondary)")};
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
  color: var(--secondary-foreground);

  &:hover{
    background-color: var(--primary);
    color: var(--primary-foreground);

    > * {
      color: var(--primary-foreground) !important;

      svg path {
        fill: var(--primary-foreground) !important;
      }
      svg .bg-rect {
        stroke: var(--primary-foreground) !important;
      }
    }

  }


  > * {
    color: var(--secondary-foreground) !important;

    svg path {
      fill: var(--secondary-foreground) !important;
    }
    svg .bg-rect {
      stroke: var(--secondary-foreground) !important;
    }
  }
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
background-color: var(--secondary);
font-family: Roboto;
font-size:14px;
font-weight: 700;
line-height: 11.72px;
text-align: center;
color: var(--secondary-foreground);
padding: 5px 0p;

& .colored{
color:#111111;
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
  cursor: "pointer";

  &.selected {
    border: 1px solid var(--primary);

    &::before {
      content: "";
      position: absolute;
      top: 10px;
      left: 10px;
    }
  }
`;

export const ThemeItem = styled.img`
  height: 100%;
  width: 100%;
  object-fit: cover;
  object-position: center;
  border-radius: 5px;
  position: relative;
  margin: 2px;
  border: 1px solid #d5d5d5;
  cursor: pointer;

  &.selected {
    border: 1px solid var(--primary);

    &::before {
      content: "";
      position: absolute;
      top: 1px;
      left: 1px;
    }
  }
`;
export const PhotoWrapper = styled.div`
  position: relative;
  // border-radius: 5px;
  border:${(props) => props.selected ? "1px solid var(--primary)" : "none"};
  box-shadow: 1px 1px 2px 2px rgba(221, 221, 221, 0.7);
  .actionbutton{
    display: none;

  }
    img{
    // border-radius: 5px;
      height:auto;
      width:100%;
  }
  &:hover {
    .checkbox {
      display: block; // Show the checkbox on hover
    }
    .actionbutton{
      display: flex;
    }
  }
  @media (max-width: 724px) {
      .actionbutton{
      display: flex;
    }
  }
`;
export const SelectCheckbox = styled.input`
  position: absolute;
  top: 5px;
  left: 5px;
  accent-color: var(--primary);
  background-color: var(--primary);
  color: var(--primary); // text-primary equivalent
  z-index: 1;
  transition: transform 0.3s ease-in-out;
  display: ${({ checked }) =>
    checked ? "block" : "none"}; // Show when checked
  @media (max-width: 724px) {
    display: block;
  }
`;

export const PhotoGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px; /* Space between items */
  justify-content: center; /* Align items at the start */

  @media (max-width: 724px) {
    justify-content: left;
    flex-wrap: nowrap;
    overflow-x: auto;
  }
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
  width: 20px;
  height: 20px;
  &:hover {
    color: darkred;
  }
  @media (max-width: 724px) {
    width: 20px;
    height: 20px;

    display: flex;
    justify-content: center;
    align-items: center;
  }
`;

export const DeleteButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  z-index: 1;
  color: red;
  font-size: 0px;
  border-radius: 100%;
  width: 20px;
  height: 20px;
  &:hover {
    color: black;
  }
  @media (max-width: 724px) {
    width: 20px;
    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
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
  bottom: 5px;
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
  color: var(--foreground);
  &.active {
    border: 1px solid var(--primary);
    color: var(--primary);
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
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const ColorPickerTrigger = styled(BackgroundColorItem)`
  background: conic-gradient(
    #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #8000ff, #ff00ff, #ff0000
  );
  position: relative;
  &::before {
    content: "+";
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: #fff;
    border-radius: 50%;
    color: var(--foreground);
    font-size: 20px;
    font-weight: bold;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    padding-bottom: 2px;
  }
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
  opacity: ${(props) => (props.disable ? 0.3 : 1)};
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
    color: var(--foreground);
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
      color: var(--foreground);
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
  background-color: ${(props) => (props.bgcolor ? props.bgcolor : "var(--secondary)")};
  border-color: var(--secondary);
  color: var(--foreground);
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

// Premium Select Component Styles
export const PremiumSelectWrapper = styled.div`
  position: relative;
  width: ${(props) => (props.width ? props.width : "100%")};
  margin-bottom: ${(props) => (props.mb ? props.mb : "0px")};
  margin-top: ${(props) => (props.mt ? props.mt : "0px")};
  margin-left: ${(props) => (props.ml ? props.ml : "0px")};
  margin-right: ${(props) => (props.mr ? props.mr : "0px")};
  font-family: 'Roboto', sans-serif;
`;

export const PremiumSelectTrigger = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 42px;
  padding: 8px 16px;
  background: #ffffff;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--secondary);

  &:hover {
    border-color: var(--primary, #4084b5);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
    transform: translateY(-1px);
  }

  &:focus-within {
    border-color: var(--primary, #4084b5);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15), 0 0 0 3px rgba(0, 0, 0, 0.1);
    outline: none;
  }

  @media (max-width: 768px) {
    min-height: 38px;
    padding: 6px 12px;
    border-radius: 5px;
  }
`;

export const PremiumSelectValue = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  color: ${(props) => (props.hasValue ? "var(--foreground, #1f4f73)" : "var(--muted-foreground, #6c8ea5)")};
  line-height: 1.4;

  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

export const PremiumSelectIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--primary, #4084b5);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: ${(props) => (props.isOpen ? "rotate(180deg)" : "rotate(0deg)")};

  svg {
    width: 18px;
    height: 18px;
  }

  @media (max-width: 768px) {
    width: 20px;
    height: 20px;

    svg {
      width: 16px;
      height: 16px;
    }
  }
`;

export const PremiumSelectDropdown = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 1000;
  background: #ffffff;
  border-radius: 5px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transform-origin: top;
  animation: ${(props) => (props.isOpen ? "dropdownOpen" : "dropdownClose")} 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;

  @keyframes dropdownOpen {
    from {
      opacity: 0;
      transform: scaleY(0.8) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scaleY(1) translateY(0);
    }
  }

  @keyframes dropdownClose {
    from {
      opacity: 1;
      transform: scaleY(1) translateY(0);
    }
    to {
      opacity: 0;
      transform: scaleY(0.8) translateY(-10px);
    }
  }

  @media (max-width: 768px) {
    border-radius: 12px;
    top: calc(100% + 4px);
  }
`;

export const PremiumSelectSearchContainer = styled.div`
  padding: 8px;
  border-bottom: 1px solid var(--secondary, #eff8ff);
`;

export const PremiumSelectSearchInput = styled.input`
  width: 100%;
  padding: 0.5rem;
  border-radius: 5px;
  font-size: 14px;
  font-weight: 400;
  color: var(--foreground, #1f4f73);
  background: #ffffff;
  transition: all 0.3s ease;

  &::placeholder {
    color: var(--muted-foreground, #6c8ea5);
    font-style: italic;
  }

  &:focus {
    outline: none;
    border-color: var(--primary, #4084b5);
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 768px) {
    padding: 10px 14px 10px 38px;
    font-size: 13px;
    border-radius: 8px;
  }
`;


export const PremiumSelectOptionsList = styled.div`
  max-height: 280px;
  overflow-y: auto;
  padding: 8px 0;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--secondary, #eff8ff);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--muted-foreground, #6c8ea5);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--primary, #4084b5);
  }

  @media (max-width: 768px) {
    max-height: 240px;
    padding: 4px 0;
  }
`;

export const PremiumSelectOption = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 5px 20px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 400;
  color: var(--foreground, #1f4f73);
  background: ${(props) => (props.isSelected ? "var(--secondary, #eff8ff)" : "transparent")};
  transition: all 0.2s ease;

  &:hover {
    background: var(--secondary, #eff8ff);
    color: var(--primary, #4084b5);
  }

  &:active {
    background: var(--primary, #4084b5);
    color: var(--primary-foreground, #ffffff);
  }

  @media (max-width: 768px) {
    padding: 12px 16px;
    font-size: 14px;
    gap: 10px;
  }
`;

export const PremiumSelectOptionIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: inherit;

  svg {
    width: 18px;
    height: 18px;
  }

  @media (max-width: 768px) {
    width: 20px;
    height: 20px;

    svg {
      width: 16px;
      height: 16px;
    }
  }
`;

export const PremiumSelectOptionText = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const PremiumSelectOptionLabel = styled.span`
  font-weight: 500;
  line-height: 1.2;
`;

export const PremiumSelectOptionDescription = styled.span`
  font-size: 12px;
  color: var(--muted-foreground, #6c8ea5);
  line-height: 1.3;

  @media (max-width: 768px) {
    font-size: 11px;
  }
`;

export const PremiumSelectNoResults = styled.div`
  padding: 24px 20px;
  text-align: center;
  color: var(--muted-foreground, #6c8ea5);
  font-size: 14px;
  font-style: italic;

  @media (max-width: 768px) {
    padding: 20px 16px;
    font-size: 13px;
  }
`;

export const PremiumSelectBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--primary, #4084b5);
  color: var(--primary-foreground, #ffffff);
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  @media (max-width: 768px) {
    padding: 3px 6px;
    font-size: 10px;
    border-radius: 4px;
  }
`;

export const PremiumSelectOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: transparent;
`;

export const StyledCollapse = styled(Collapse)`
  background-color: var(--secondary);
  padding: 8px;
  margin-bottom: 10px;
  &:last-child {
    margin-bottom: 0px;
  }
`;

export const ThemeTitle = styled.div`
  font-family: Roboto;
  font-size: 10px;
  font-weight: 500;
  line-height: 11.72px;
  text-align: center;
  color: var(--foreground);
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
  color: var(--foreground);
`;

export const TextSelect = styled(Form.Select)`
  width: ${(props) => (props.width ? props.width : "100%")};
  height: 32px;
  padding: 6px 8px 6px 8px;
  border-radius: 5px;
  border-color: #f9f9f9;
  background-color: #f9f9f9;
  font-family: Roboto;
  font-size: 14px;
  font-weight: 500;
  line-height: 15px;
  text-align: left;
  color: var(--foreground);
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
    // calc(100vh - 100px);
    // height: calc(100vh - 100px);
  }

  @media (max-width: 724px) {
    .modal-content {
      width: 100%;
      margin: 0px;
      border: none;
      // height: calc(100vh - 100px);
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
  background-color: var(--secondary);
  height: 62px;
  padding: 17px 28px 17px 83px;
  border-bottom: none;
  justify-content: end;

  /* Bootstrap's default .btn-close is a faint (opacity 0.5) ~16px dark glyph on a
     transparent background. Over the varied preview backdrops — a light room wall,
     a dark 3D scene, a white photobook spread — it is effectively invisible, which
     reads to users as "the preview has no close (X) button". Render it instead as
     an explicit high-contrast circular chip (dark translucent disc + solid WHITE X
     + light ring + shadow) that stays legible on ANY of those backgrounds. This is
     INHERITED by PhotoModalCloseHeader (the headerless variant used by the wall /
     photobook / folding previews), so every product preview gets the same clearly
     visible close button. Keep it in normal flow (position: relative) so the header
     padding controls its inset — Bootstrap's base rule makes it position:absolute. */
  .btn-close {
    position: relative;
    top: auto;
    right: auto;
    box-sizing: border-box;
    width: 38px;
    height: 38px;
    margin: 0;
    padding: 0;
    border-radius: 50%;
    opacity: 1;
    background-color: rgba(15, 23, 42, 0.6);
    background-size: 14px 14px;
    border: 1.5px solid rgba(255, 255, 255, 0.7);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
    /* White glyph so the X contrasts against the dark disc (default is #000). */
    --bs-btn-close-bg: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23fff'%3e%3cpath d='M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414'/%3e%3c/svg%3e");
    transition: background-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }
  .btn-close:hover {
    opacity: 1;
    background-color: rgba(15, 23, 42, 0.82);
    transform: scale(1.06);
  }
  .btn-close:focus,
  .btn-close:focus-visible {
    opacity: 1;
    outline: none;
    box-shadow: 0 0 0 0.22rem rgba(255, 255, 255, 0.45), 0 2px 10px rgba(0, 0, 0, 0.35);
  }

  @media (max-width: 1024px) {
    padding: 0px 5px 0px 10px;
  }
  @media (max-width: 724px) {
    padding: 0px 5px 0px 10px;
    flex-direction: row-reverse;
    // background-color: transparent;
  }
`;

// Headerless variant: no title bar / background — just the close (X) button
// floating in the top-right corner over the preview body. Used by the flat
// product previews (photobook, folding, wall) that only ever showed a title.
export const PhotoModalCloseHeader = styled(PhotoModalHeader)`
  position: absolute;
  top: 0;
  right: 0;
  left: auto;
  width: auto;
  height: auto;
  min-height: 0;
  background-color: transparent;
  border-bottom: none;
  padding: 14px 18px;
  /* Must sit ABOVE the preview body. The wall previews (calendar / acrylic) render
     inside WallContainer, which is position:relative with z-index:10000 — because
     PhotoModalBody isn't a stacking context, that 10000 is promoted into the shared
     modal-content context and would paint the room backdrop OVER a low-z-index close
     header, hiding the X (the photobook/folding previews have no such container, so
     their X already showed). Keep this above WallContainer's 10000. */
  z-index: 10050;
  @media (max-width: 1024px) {
    padding: 12px 14px;
  }
  @media (max-width: 724px) {
    padding: 12px 14px;
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
    overflow: auto;
    padding: 20px;
    background: #ffffff !important;

    position: relative;
  }
  @media (max-width: 724px) {
    display: grid;
    // grid-template-rows:70px 1fr;
    padding: 10px;
    & .side-bar {
      flex-direction: row;
      width: 100%;
      box-shadow: none;
      height: max-content;
    }
    & .modal-body-main-content {
      overflow-x: auto;
    }
    & .photo-body-main-content-mob {
      max-height: 70vh;
    }
  }
`;

export const PhotoOptionItem = styled.div`
  display: flex;
  padding: 0px 20px;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  & .title {
    font-family: Roboto;
    font-size: 14px;
    font-weight: 600;
    width: max-content;
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
    color: var(--primary);
  }
  &.active svg path:not([fill="none"]) {
    fill: var(--primary);
  }
  &.active svg path.has-stroke {
    fill: #ffffff00 !important;
    stroke: var(--primary) !important;
  }

  @media (max-width: 724px) {
    padding: 0;
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
  color: ${(props) => (props.color ? props.color : "var(--foreground)")};
`;

export const Title20 = styled.div`
  font-family: Roboto;
  font-size: ${(props) => (props.fontsize ? props.fontsize : "20px")};
  font-weight: ${(props) => (props.fontweight ? props.fontweight : "500")};
  line-height: 23.44px;
  text-align: ${(props) => (props.align ? props.align : "left")};
  color: ${(props) => (props.color ? props.color : "var(--foreground)")};
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
    color: var(--foreground);
  }
`;
export const AddMyPhotoItem = styled.div`
  margin-top: 10px;
  position: relative;

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
  height: calc(70vh - 140px);
  overflow-y: auto;
  &.seleted-visible {
    padding-bottom: 100px;
  }
  @media (max-width: 724px) {
    &.add-photo-box {
      padding-top: 0px;
      padding-left: 0px;

      height: 45vh;
    }
  }
`;
export const SelectedPhotoBox = styled.div`
  padding: 10px 20px;
  box-shadow: 0px -4px 3px 0px #0000001f;
  bottom: 0px;
  position: relative;
  background-color: #fff;
  img {
    height: 60px;
    width: 60px;
  }
  @media (max-width: 768px) {
    img {
      height: 40px;
      width: 40px;
    }
  }
`;
export const ScrollButton = styled.button`
  position: absolute;
  top: 40%;
  transform: translateY(50%);
  background: #fff;
  border: none;
  color: var(--foreground);
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
flex-grow-1;
align-items: center;
.progress {
    flex-grow: 1;
    margin-right: 10px;
    height:10px;
    width:120px;
    border-radius:10px;
}
.progress-bar{
background:#66B49D;
}
.progress-label {
    white-space: nowrap;
    color:#66B49D;
}
    @media(max-width:724px){
     flex-direction:column;
     gap:10px;
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
  background-color: var(--primary); // Color for the drop indicator
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

export const WallContainer = styled.div`
  z-index: 10000;
  display: flex;
  justify-content: center;
  // align-items: center;
  width: 100%;
  // padding-right:40%;
  padding-top: 3rem;
  position: relative;
  height: 100%;
  background-image: url(${(props) => props.desktopBackGroundImage});
  background-position: center;
  background-size: cover;
  // object-fit:contain;

  background-repeat: no-repeat;
  @media (max-width: 768px) {
    justify-content: end;
    background-image: url(${(props) =>
      props.mobileBackGroundImage}); /* smaller image for mobile */
    padding-right: 1rem;
    padding-top: 1rem;
  }
`;

export const NoticeTitle = styled.p`
  margin-bottom: 0;
  &:: before {
    background-color: var(--primary);
    display: inline-block;
    margin-right: 10px;
    -moz-border-radius: 50%;
    border-radius: 50%;
    content: "";
    width: 7px;
    max-width: 7px;
    height: 7px;
    min-width: 7px;
  }
`;
export const NoticeMessage = styled.p`
  color: #aeaeae;
  font-size: 0.7rem;
  margin-bottom: 0;
  // height:2rem;
  max-height: 2rem;
  line-height: 1rem;
  over-flow: hidden;
  text-overflow: ellipsis;
`;

export const TopLeftScrew = styled.img`
  width: 0.5rem;
  height: 0.5rem;
  position: absolute;
  z-index: 1;
  top: ${(props) => (props.top ? props.top : "0")};
  left: ${(props) => (props.left ? props.left : "0")};
  object-fit: contain;
  object-position: center;
`;

export const TopRightScrew = styled.img`
  width: 0.5rem;
  height: 0.5rem;
  position: absolute;
  z-index: 1;
  top: ${(props) => (props.top ? props.top : "0")};
  right: ${(props) => (props.right ? props.right : "0")};
  object-fit: contain;
  object-position: center;
`;

export const BottomLeftScrew = styled.img`
  width: 0.5rem;
  height: 0.5rem;
  position: absolute;
  z-index: 1;
  bottom: ${(props) => (props.bottom ? props.bottom : "0")};
  left: ${(props) => (props.left ? props.left : "0")};
  object-fit: contain;
  object-position: center;
`;

export const BottomRightScrew = styled.img`
  width: 0.5rem;
  height: 0.5rem;
  position: absolute;
  z-index: 1;
  bottom: ${(props) => (props.bottom ? props.bottom : "0")};
  right: ${(props) => (props.right ? props.right : "0")};
  object-fit: contain;
  object-position: center;
`;

// for 3d modal preveiw
const l18 = keyframes`
  0%   {clip-path:polygon(50% 50%,0 0,0    0,0    0   ,0    0   ,0    0   )}
  25%  {clip-path:polygon(50% 50%,0 0,100% 0,100% 0   ,100% 0   ,100% 0   )}
  50%  {clip-path:polygon(50% 50%,0 0,100% 0,100% 100%,100% 100%,100% 100%)}
  75%  {clip-path:polygon(50% 50%,0 0,100% 0,100% 100%,0    100%,0    100%)}
  100% {clip-path:polygon(50% 50%,0 0,100% 0,100% 100%,0    100%,0    0   )}
`;

export const CommonLoader = styled.div`
  width: ${(props) => (props.width ? props.width : "5rem")};
  aspect-ratio: 1;
  border: ${(props) => (props.borderWidth ? props.borderWidth : "0.938rem")}
    solid #ddd;
  border-radius: 50%;
  position: relative;
  transform: rotate(45deg);

  &:before {
    content: "";
    position: absolute;
    inset: -${(props) => (props.borderWidth ? props.borderWidth : "0.938rem")};
    border-radius: 50%;
    border: ${(props) => (props.borderWidth ? props.borderWidth : "0.938rem")}
      solid var(--primary);
    animation: ${l18} 2s infinite linear;
  }
`;

export const CommonLoaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  font-size: 1.5rem;
  &::after {
    margin-top: 2rem;
    color: ${(props) => (props.color ? props.color : "white")};
    font-weight: 600;
    text-align: ${(props) => (props.textAlign ? props.textAlign : "center")};
    text-wrap: wrap;
    word-wrap: break-word;
    white-space: wrap;
    // word-break: break-all;
    overflow-wrap: break-word;
    font-size: ${(props) => (props.fontSize ? props.fontSize : "1.5rem")};
    content: "${(props) => (props.text ? props.text : "")}";
  }
`;

export const MenuIconWrapper = styled.div`
  width: ${(props) => (props.width ? props.width : "20px")};
  height: ${(props) => (props.height ? props.height : "20px")};
  border-radius: 5px;
  border: ${(props) =>
    props.active ? "2px solid var(--primary)" : "2px solid transparent"};
  display: flex;
  align-items: center;
  padding: 5px;
  cursor: pointer;
  justify-content: center;
`;

// Beautiful Color Picker Modal Components
export const ColorPickerModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  z-index: 9999;
  padding: 20px;
  width: 100%;
`;

export const ColorPickerModalContainer = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  width: auto;
  min-width: 280px;
  max-width: 400px;
  max-height: 90vh;
  overflow: auto;
  position: relative;
  animation: colorPickerFadeIn 0.3s ease-out;

  /* Hide scrollbar for the modal container */
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }

  @keyframes colorPickerFadeIn {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Large screens (desktop) */
  @media (min-width: 1200px) {
    min-width: 320px;
    max-width: 400px;
  }

  /* Medium screens (tablets) */
  @media (max-width: 1199px) and (min-width: 769px) {
    min-width: 300px;
    max-width: 380px;
  }

  /* Small screens (tablets/small laptops) */
  @media (max-width: 768px) {
    min-width: 280px;
    max-width: 90vw;
    margin: 10px;
    padding: 15px;
    border-radius: 8px;
  }

  /* Extra small screens (mobile) */
  @media (max-width: 480px) {
    min-width: unset;
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
    margin: 10px;
    padding: 12px;
  }
`;

export const ColorPickerModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;

  h5 {
    margin: 0;
    color: #333;
    font-weight: 600;
    font-size: 16px;
  }
`;

export const ColorPickerCloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;

  &:hover {
    background-color: #f5f5f5;
    color: #333;
  }
`;

export const ColorPickerContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 10px;
  gap: 15px;

  .sketch-picker {
    box-shadow: none !important;
    border: 1px solid #eee !important;
    border-radius: 8px !important;
  }
`;

export const ColorPickerPreview = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 8px;
  width: 100%;
  justify-content: center;

  .color-preview {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: 2px solid #ddd;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .color-info {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .color-label {
      font-size: 12px;
      color: #666;
      font-weight: 500;
    }

    .color-value {
      font-size: 14px;
      color: #333;
      font-weight: 600;
      font-family: monospace;
    }
  }
`;

export const ColorPickerActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 15px;
  // width: 100%;
  width: max-content;

  button {
    flex: 1;
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &.primary {
      background-color: ${(props) => props.theme.colors.primaryColor};
      color: white;

      &:hover {
        background-color: var(--primary);
      }
    }

    &.secondary {
      background-color: #f5f5f5;
      color: #666;

      &:hover {
        background-color: #e9e9e9;
      }
    }
  }

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

export const shimmerAnimation = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
`;

export const SkeletonFooterPage = styled.div`
  min-width: 151px; /* Base width */
  min-height: 104px; /* Base height */
  margin: 10px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 400px 100%;
  animation: ${shimmerAnimation} 1.4s ease infinite;
  border-radius: 4px;
`;

/* Shimmer skeleton shown over a CANVAS image/sticker box while its bitmap is
   still loading (e.g. after a page refresh). Same animated gray sweep as the
   Photos gallery SkeletonTile so the loading look is consistent app-wide. It is
   absolutely positioned to fill its (box-sized, position:relative) container and
   sits inside the object's clipPath group, so it inherits the frame's rounded /
   masked corners automatically. `not-exportable` keeps it out of saved/exported
   SVG; `pointer-events:none` keeps drag/select behaviour unchanged. */
export const canvasImageSkeletonShimmer = keyframes`
  0% { background-position: -150% 0; }
  100% { background-position: 150% 0; }
`;

export const CanvasImageSkeleton = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background: linear-gradient(
    100deg,
    #cdd2d9 30%,
    #e3e7ec 50%,
    #cdd2d9 70%
  );
  background-size: 200% 100%;
  animation: ${canvasImageSkeletonShimmer} 1.3s ease-in-out infinite;
`;

