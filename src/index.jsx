import React from "react";
import ReactDOM from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import { store } from "./store/store";
import { Provider } from "react-redux";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App/app";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PdfExportProvider } from "./contexts/PdfExportContext.jsx";
import { isDesktop } from "./desktop/index";

// Desktop (Electron) loads from app:// where BrowserRouter's history API has no server and
// would 404 on reload/deep links — use HashRouter there. Web is unchanged (BrowserRouter).
const Router = isDesktop ? HashRouter : BrowserRouter;
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Provider store={store}>
    <Router>
      <PdfExportProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </PdfExportProvider>
    </Router>
  </Provider>

  // <React.StrictMode>
  //   <Provider store={store}>
  //     <BrowserRouter>
  //       <App />
  //     </BrowserRouter>
  //   </Provider>
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
