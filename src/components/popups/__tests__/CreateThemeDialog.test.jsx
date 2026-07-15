// CreateThemeDialog — offline-first theme creation. When the saveAsTheme API is
// unreachable, the dialog must still create the theme: apply it to the live
// editor and store it in the Saved Designs library (the Design Selection
// "Your Designs" panel) under a local id. A genuine server rejection must NOT
// create anything locally.

// common-functions/index.js transitively pulls generatePageSvg → commonJSON →
// PhotosAction → canvas.js, a module cycle jest's load order can't resolve
// (webpack's entry order happens to). Cut the chain — nothing here renders SVG.
jest.mock("../../../library/utils/common-functions/generatePageSvg.js", () => ({
  generatePageSvg: () => "",
}));

// Network layer under test control.
jest.mock("../../../library/utils/common-services/apiCall.js", () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
  apiMultiPartPost: jest.fn(),
  apiMultiPartPatch: jest.fn(),
}));

// The dialog renders null for customers; act as an admin.
jest.mock("../../../library/utils/services/theme/index.js", () => ({
  getUserDetails: () => ({ userTypeCode: 3 }),
}));

// Only `recommendedSizes` is consumed by the dialog — avoid loading the big
// SizeSettingsPopup component tree.
jest.mock("../SizeSettingsPopup.jsx", () => ({
  __esModule: true,
  default: () => null,
  recommendedSizes: [],
}));

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { store } from "../../../store/store.jsx";
import CreateThemeDialog from "../CreateThemeDialog.jsx";
import { apiPost } from "../../../library/utils/common-services/apiCall.js";
import {
  listSavedDesigns,
  resetActiveLocalDesignId,
} from "../../../library/utils/helpers/savedDesigns.js";

const renderDialog = (onClose) =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <CreateThemeDialog show onClose={onClose} isNewTheme />
      </MemoryRouter>
    </Provider>
  );

const createTheme = async (name) => {
  userEvent.type(
    screen.getByPlaceholderText("Enter a name for your theme..."),
    name
  );
  userEvent.click(screen.getByRole("button", { name: "Create New Theme" }));
};

beforeEach(() => {
  localStorage.clear();
  resetActiveLocalDesignId();
  jest.clearAllMocks();
});

it("creates the theme locally when the API is unreachable", async () => {
  // apiPost never throws — network failure surfaces as { error } with no
  // response attached.
  apiPost.mockResolvedValue({ error: { message: "Network Error" } });
  const onClose = jest.fn();
  renderDialog(onClose);

  await createTheme("Offline Birthday");

  await waitFor(() => expect(onClose).toHaveBeenCalled());

  // Stored in the Saved Designs library under a local id, with the typed name.
  const designs = await listSavedDesigns();
  expect(designs).toHaveLength(1);
  expect(designs[0].id).toMatch(/^local:/);
  expect(designs[0].name).toBe("Offline Birthday");

  // The live editor carries the new theme: name set, no server id, pages applied.
  const ps = store.getState().projectSetup;
  expect(ps.themeDetails.theme_name).toBe("Offline Birthday");
  expect(ps.themeDetails.theme_id).toBeFalsy();
  const pages = store.getState().canvas.present.pages;
  expect(pages).toHaveLength(1);
  expect(pages[0].layout).toHaveLength(1);
  expect(pages[0].layout[0].objects).toEqual([]);
});

it("does NOT create locally when the server rejects the theme", async () => {
  apiPost.mockResolvedValue({ status: 0, message: "Name already exists" });
  const onClose = jest.fn();
  renderDialog(onClose);

  await createTheme("Rejected Theme");

  await waitFor(() => expect(apiPost).toHaveBeenCalled());
  // The dialog stays open (so the user can fix and retry) and nothing is stored.
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Create New Theme" })
    ).toBeEnabled()
  );
  expect(onClose).not.toHaveBeenCalled();
  expect(await listSavedDesigns()).toHaveLength(0);
});
