/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

import { createStore, selectors, actions } from "../../utils/test-head";

jest.mock("../../utils/editor");

const { getActiveSearch, getFileSearchQuery, getFileSearchResults } = selectors;

const threadFront = {
  sourceContents: async () => ({
    source: "function foo1() {\n  const foo = 5; return foo;\n}",
    contentType: "text/javascript",
  }),
  getSourceActorBreakpointPositions: async () => ({}),
  getSourceActorBreakableLines: async () => [],
};

describe("navigation", () => {
  it("navigation clears the file-search query", async () => {
    const { dispatch, getState, cx } = createStore(threadFront);

    dispatch(actions.setFileSearchQuery(cx, "foobar"));
    expect(getFileSearchQuery(getState())).toBe("foobar");

    await dispatch(actions.willNavigate("will-navigate"));

    expect(getFileSearchQuery(getState())).toBe("");
  });

  it("navigation clears the file-search results", async () => {
    const { dispatch, getState, cx } = createStore(threadFront);

    const searchResults = [
      { line: 1, ch: 3 },
      { line: 3, ch: 2 },
    ];
    dispatch(actions.updateSearchResults(cx, 2, 3, searchResults));
    expect(getFileSearchResults(getState())).toEqual({
      count: 2,
      index: 2,
      matchIndex: 1,
      matches: searchResults,
    });

    await dispatch(actions.willNavigate("will-navigate"));

    expect(getFileSearchResults(getState())).toEqual({
      count: 0,
      index: -1,
      matchIndex: -1,
      matches: [],
    });
  });

  it("navigation removes activeSearch 'file' value", async () => {
    const { dispatch, getState } = createStore(threadFront);
    dispatch(actions.setActiveSearch("file"));
    expect(getActiveSearch(getState())).toBe("file");

    await dispatch(actions.willNavigate("will-navigate"));
    expect(getActiveSearch(getState())).toBe(null);
  });
});
