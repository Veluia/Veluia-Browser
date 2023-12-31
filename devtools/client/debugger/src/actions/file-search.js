/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

import {
  clearSearch,
  find,
  findNext,
  findPrev,
  removeOverlay,
  searchSourceForHighlight,
} from "../utils/editor";
import { renderWasmText } from "../utils/wasm";

import {
  getSelectedSourceId,
  getSelectedSourceTextContent,
  getSearchOptions,
  getFileSearchQuery,
  getFileSearchResults,
} from "../selectors";

import {
  closeActiveSearch,
  clearHighlightLineRange,
  setActiveSearch,
} from "./ui";
import { isFulfilled } from "../utils/async-value";

export function doSearch(cx, query, editor) {
  return ({ getState, dispatch }) => {
    const sourceTextContent = getSelectedSourceTextContent(getState());
    if (!sourceTextContent) {
      return;
    }

    dispatch(setFileSearchQuery(cx, query));
    dispatch(searchContents(cx, query, editor));
  };
}

export function doSearchForHighlight(query, editor, line, ch) {
  return async ({ getState, dispatch }) => {
    const sourceTextContent = getSelectedSourceTextContent(getState());
    if (!sourceTextContent) {
      return;
    }

    dispatch(searchContentsForHighlight(query, editor, line, ch));
  };
}

export function setFileSearchQuery(cx, query) {
  return {
    type: "UPDATE_FILE_SEARCH_QUERY",
    cx,
    query,
  };
}

export function updateSearchResults(cx, characterIndex, line, matches) {
  const matchIndex = matches.findIndex(
    elm => elm.line === line && elm.ch === characterIndex
  );

  return {
    type: "UPDATE_SEARCH_RESULTS",
    cx,
    results: {
      matches,
      matchIndex,
      count: matches.length,
      index: characterIndex,
    },
  };
}

export function searchContents(cx, query, editor, focusFirstResult = true) {
  return async ({ getState, dispatch, searchWorker }) => {
    const modifiers = getSearchOptions(getState(), "file-search");
    const sourceTextContent = getSelectedSourceTextContent(getState());

    if (
      !editor ||
      !sourceTextContent ||
      !isFulfilled(sourceTextContent) ||
      !modifiers
    ) {
      return;
    }
    const selectedContent = sourceTextContent.value;

    const ctx = { ed: editor, cm: editor.codeMirror };

    if (!query) {
      clearSearch(ctx.cm, query);
      return;
    }

    let text;
    if (selectedContent.type === "wasm") {
      const selectedSourceId = getSelectedSourceId(getState());
      text = renderWasmText(selectedSourceId, selectedContent).join("\n");
    } else {
      text = selectedContent.value;
    }

    const matches = await searchWorker.getMatches(query, text, modifiers);

    const res = find(ctx, query, true, modifiers, focusFirstResult);
    if (!res) {
      return;
    }

    const { ch, line } = res;

    dispatch(updateSearchResults(cx, ch, line, matches));
  };
}

export function searchContentsForHighlight(query, editor, line, ch) {
  return async ({ getState, dispatch }) => {
    const modifiers = getSearchOptions(getState(), "file-search");
    const sourceTextContent = getSelectedSourceTextContent(getState());

    if (!query || !editor || !sourceTextContent || !modifiers) {
      return;
    }

    const ctx = { ed: editor, cm: editor.codeMirror };
    searchSourceForHighlight(ctx, false, query, true, modifiers, line, ch);
  };
}

export function traverseResults(cx, rev, editor) {
  return async ({ getState, dispatch }) => {
    if (!editor) {
      return;
    }

    const ctx = { ed: editor, cm: editor.codeMirror };

    const query = getFileSearchQuery(getState());
    const modifiers = getSearchOptions(getState(), "file-search");
    const { matches } = getFileSearchResults(getState());

    if (query === "") {
      dispatch(setActiveSearch("file"));
    }

    if (modifiers) {
      const matchedLocations = matches || [];
      const findArgs = [ctx, query, true, modifiers];
      const results = rev ? findPrev(...findArgs) : findNext(...findArgs);

      if (!results) {
        return;
      }
      const { ch, line } = results;
      dispatch(updateSearchResults(cx, ch, line, matchedLocations));
    }
  };
}

export function closeFileSearch(cx, editor) {
  return ({ getState, dispatch }) => {
    if (editor) {
      const query = getFileSearchQuery(getState());
      const ctx = { ed: editor, cm: editor.codeMirror };
      removeOverlay(ctx, query);
    }

    dispatch(setFileSearchQuery(cx, ""));
    dispatch(closeActiveSearch());
    dispatch(clearHighlightLineRange());
  };
}
