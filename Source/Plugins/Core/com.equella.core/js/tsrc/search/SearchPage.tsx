/*
 * Licensed to The Apereo Foundation under one or more contributor license
 * agreements. See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 * The Apereo Foundation licenses this file to you under the Apache License,
 * Version 2.0, (the "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at:
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Card, CardContent, Grid, Typography } from "@material-ui/core";
import * as OEQ from "@openequella/rest-api-client";

import { isEqual, pick } from "lodash";
import * as React from "react";
import { useCallback, useEffect, useReducer, useState } from "react";
import { useHistory, useLocation } from "react-router";
import { Static } from "runtypes";
import { generateFromError } from "../api/errors";
import { AppConfig } from "../AppConfig";
import { DateRangeSelector } from "../components/DateRangeSelector";
import MessageInfo from "../components/MessageInfo";
import { routes } from "../mainui/routes";
import {
  templateDefaults,
  templateError,
  TemplateUpdateProps,
} from "../mainui/Template";
import { getAdvancedSearchesFromServer } from "../modules/AdvancedSearchModule";
import type { Collection } from "../modules/CollectionsModule";
import {
  buildSelectionSessionAdvancedSearchLink,
  buildSelectionSessionRemoteSearchLink,
  isSelectionSessionInStructured,
  prepareDraggable,
} from "../modules/LegacySelectionSessionModule";
import { getRemoteSearchesFromServer } from "../modules/RemoteSearchModule";
import {
  Classification,
  listClassifications,
  SelectedCategories,
} from "../modules/SearchFacetsModule";
import {
  DateRange,
  defaultPagedSearchResult,
  defaultSearchOptions,
  generateQueryStringFromSearchOptions,
  queryStringParamsToSearchOptions,
  searchItems,
  SearchOptions,
} from "../modules/SearchModule";
import {
  getSearchSettingsFromServer,
  SearchSettings,
  SortOrder,
} from "../modules/SearchSettingsModule";
import SearchBar from "../search/components/SearchBar";
import { languageStrings } from "../util/langstrings";
import { AuxiliarySearchSelector } from "./components/AuxiliarySearchSelector";
import { CategorySelector } from "./components/CategorySelector";
import { CollectionSelector } from "./components/CollectionSelector";
import OwnerSelector from "./components/OwnerSelector";
import {
  RefinePanelControl,
  RefineSearchPanel,
} from "./components/RefineSearchPanel";
import { SearchAttachmentsSelector } from "./components/SearchAttachmentsSelector";
import {
  mapSearchResultItems,
  SearchResultList,
} from "./components/SearchResultList";
import StatusSelector from "./components/StatusSelector";

// destructure strings import
const searchStrings = languageStrings.searchpage;
const {
  title: dateModifiedSelectorTitle,
  quickOptionDropdown,
} = searchStrings.lastModifiedDateSelector;
const { title: collectionSelectorTitle } = searchStrings.collectionSelector;

/**
 * Type of search options that are specific to Search page presentation layer.
 */
export interface SearchPageOptions extends SearchOptions {
  /**
   * Whether to enable Quick mode (true) or to use custom date pickers (false).
   */
  dateRangeQuickModeEnabled: boolean;
}

/**
 * Structure of data stored in browser history state, to capture the current state of SearchPage
 */
interface SearchPageHistoryState {
  /**
   * SearchPageOptions to store in history
   */
  searchPageOptions: SearchPageOptions;
  /**
   * Open/closed state of refine expansion panel
   */
  filterExpansion: boolean;
}

type Action =
  | { type: "init" }
  | { type: "search"; options: SearchPageOptions }
  | {
      type: "search-complete";
      result: OEQ.Search.SearchResult<OEQ.Search.SearchResultItem>;
      classifications: Classification[];
    }
  | { type: "error"; cause: Error };

type State =
  | { status: "initialising" }
  | { status: "searching"; options: SearchPageOptions }
  | {
      status: "success";
      result: OEQ.Search.SearchResult<OEQ.Search.SearchResultItem>;
      classifications: Classification[];
    }
  | { status: "failure"; cause: Error };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "init":
      return { status: "initialising" };
    case "search":
      return { status: "searching", options: action.options };
    case "search-complete":
      return {
        status: "success",
        result: action.result,
        classifications: action.classifications,
      };
    case "error":
      return { status: "failure", cause: action.cause };
    default:
      throw new TypeError("Unexpected action passed to reducer!");
  }
};

const SearchPage = ({ updateTemplate }: TemplateUpdateProps) => {
  const history = useHistory();
  const location = useLocation();

  const [state, dispatch] = useReducer(reducer, { status: "initialising" });
  const defaultSearchPageOptions: SearchPageOptions = {
    ...defaultSearchOptions,
    dateRangeQuickModeEnabled: true,
  };

  const defaultSearchPageHistory: SearchPageHistoryState = {
    searchPageOptions: defaultSearchPageOptions,
    filterExpansion: false,
  };
  const searchPageHistoryState: SearchPageHistoryState | undefined = history
    .location.state as SearchPageHistoryState;
  const [searchPageOptions, setSearchPageOptions] = useState<SearchPageOptions>(
    // If the user has gone 'back' to this page, then use their previous options. Otherwise
    // we start fresh - i.e. if a new navigation to Search Page.
    searchPageHistoryState?.searchPageOptions ??
      defaultSearchPageHistory.searchPageOptions
  );
  const [filterExpansion, setFilterExpansion] = useState(
    searchPageHistoryState?.filterExpansion ??
      defaultSearchPageHistory.filterExpansion
  );
  const [
    showSearchCopiedSnackBar,
    setShowSearchCopiedSnackBar,
  ] = useState<boolean>(false);
  const [searchSettings, setSearchSettings] = useState<SearchSettings>();

  const handleError = useCallback(
    (error: Error) => {
      dispatch({ type: "error", cause: error });
    },
    [dispatch]
  );

  const search = useCallback(
    (searchPageOptions: SearchPageOptions): void =>
      dispatch({ type: "search", options: { ...searchPageOptions } }),
    [dispatch]
  );

  /**
   * Error display -> similar to onError hook, however in the context of reducer need to do manually.
   */
  useEffect(() => {
    if (state.status === "failure") {
      updateTemplate(templateError(generateFromError(state.cause)));
    }
  }, [state, updateTemplate]);

  /**
   * Page initialisation -> Update the page title, retrieve Search settings and trigger first
   * search.
   */
  useEffect(() => {
    if (state.status !== "initialising") {
      return;
    }

    updateTemplate((tp) => ({
      ...templateDefaults(searchStrings.title)(tp),
    }));

    Promise.all([
      getSearchSettingsFromServer(),
      // If the search options are available from browser history, ignore those in the query string.
      (location.state as SearchPageHistoryState)
        ? Promise.resolve(undefined)
        : queryStringParamsToSearchOptions(location),
    ])
      .then(([searchSettings, queryStringSearchOptions]) => {
        setSearchSettings(searchSettings);
        search(
          queryStringSearchOptions
            ? {
                ...queryStringSearchOptions,
                dateRangeQuickModeEnabled: false,
                sortOrder:
                  queryStringSearchOptions.sortOrder ??
                  searchSettings.defaultSearchSort,
              }
            : {
                ...searchPageOptions,
                sortOrder:
                  searchPageOptions.sortOrder ??
                  searchSettings.defaultSearchSort,
              }
        );
      })
      .catch((e) => {
        handleError(e);
      });
  }, [
    dispatch,
    handleError,
    location,
    search,
    searchPageOptions,
    state.status,
    updateTemplate,
  ]);

  /**
   * Searching -> Executing the search (including for classifications) and returning the results.
   */
  useEffect(() => {
    if (state.status === "searching") {
      setSearchPageOptions(state.options);
      Promise.all([
        searchItems(state.options),
        listClassifications(state.options),
      ])
        .then(
          ([result, classifications]: [
            OEQ.Search.SearchResult<OEQ.Search.SearchResultItem>,
            Classification[]
          ]) => {
            dispatch({
              type: "search-complete",
              result: { ...result },
              classifications: [...classifications],
            });
            // Update history
            history.replace({
              ...history.location,
              state: { searchPageOptions: state.options, filterExpansion },
            });
            // scroll back up to the top of the page
            window.scrollTo(0, 0);
          }
        )
        .catch(handleError);
    }
  }, [dispatch, filterExpansion, handleError, history, state]);

  // In Selection Session, once a new search result is returned, make each
  // new search result Item draggable. Could probably merge into 'searching'
  // effect, however this is only required while selections sessions still
  // involve legacy content.
  useEffect(() => {
    if (state.status === "success" && isSelectionSessionInStructured()) {
      state.result.results.forEach(({ uuid }) => {
        prepareDraggable(uuid);
      });
    }
  }, [state]);

  const handleSortOrderChanged = (order: Static<typeof SortOrder>) =>
    search({ ...searchPageOptions, sortOrder: order });

  const handleQueryChanged = (query: string) =>
    search({
      ...searchPageOptions,
      query: query,
      currentPage: 0,
      selectedCategories: undefined,
    });

  const handleCollectionSelectionChanged = (collections: Collection[]) => {
    search({
      ...searchPageOptions,
      collections: collections,
      currentPage: 0,
      selectedCategories: undefined,
    });
  };

  const handleCollapsibleFilterClick = () => {
    setFilterExpansion(!filterExpansion);
  };

  /**
   * Determines if any collapsible filters have been modified from their defaults
   */
  const areCollapsibleFiltersSet = (): boolean => {
    const getCollapsibleOptions = (options: SearchOptions) =>
      pick(options, [
        "lastModifiedDateRange",
        "owner",
        "status",
        "searchAttachments",
      ]);

    return !isEqual(
      getCollapsibleOptions(defaultSearchOptions),
      getCollapsibleOptions(searchPageOptions)
    );
  };

  const handlePageChanged = (page: number) =>
    search({ ...searchPageOptions, currentPage: page });

  const handleRowsPerPageChanged = (rowsPerPage: number) =>
    search({
      ...searchPageOptions,
      currentPage: 0,
      rowsPerPage: rowsPerPage,
    });

  const handleRawModeChanged = (rawMode: boolean) =>
    search({ ...searchPageOptions, rawMode: rawMode });

  const handleQuickDateRangeModeChange = (
    quickDateRangeMode: boolean,
    dateRange?: DateRange
  ) =>
    search({
      ...searchPageOptions,
      dateRangeQuickModeEnabled: quickDateRangeMode,
      // When the mode is changed, the date range may also need to be updated.
      // For example, if a custom date range is converted to Quick option 'All', then both start and end should be undefined.
      lastModifiedDateRange: dateRange,
      selectedCategories: undefined,
    });

  const handleLastModifiedDateRangeChange = (dateRange?: DateRange) =>
    search({
      ...searchPageOptions,
      lastModifiedDateRange: dateRange,
      selectedCategories: undefined,
    });

  const handleClearSearchOptions = () => {
    search({
      ...defaultSearchPageOptions,
      sortOrder: searchSettings?.defaultSearchSort,
    });
    setFilterExpansion(false);
  };

  const handleCopySearch = () => {
    //base institution urls have a trailing / that we need to get rid of
    const instUrl = AppConfig.baseUrl.slice(0, -1);
    const searchUrl = `${instUrl}${
      location.pathname
    }?${generateQueryStringFromSearchOptions(searchPageOptions)}`;

    navigator.clipboard
      .writeText(searchUrl)
      .then(() => {
        setShowSearchCopiedSnackBar(true);
      })
      .catch(() => handleError);
  };

  const handleOwnerChange = (owner: OEQ.UserQuery.UserDetails) =>
    search({
      ...searchPageOptions,
      owner: { ...owner },
      selectedCategories: undefined,
    });

  const handleOwnerClear = () =>
    search({
      ...searchPageOptions,
      owner: undefined,
      selectedCategories: undefined,
    });

  const handleStatusChange = (status: OEQ.Common.ItemStatus[]) =>
    search({
      ...searchPageOptions,
      status: [...status],
      selectedCategories: undefined,
    });

  const handleSearchAttachmentsChange = (searchAttachments: boolean) => {
    search({
      ...searchPageOptions,
      searchAttachments: searchAttachments,
    });
  };

  const handleSelectedCategoriesChange = (
    selectedCategories: SelectedCategories[]
  ) => {
    const getSchemaNode = (id: number) => {
      const node =
        state.status === "success" &&
        state.classifications.find((c) => c.id === id)?.schemaNode;
      if (!node) {
        throw new Error(`Unable to find schema node for classification ${id}.`);
      }
      return node;
    };

    search({
      ...searchPageOptions,
      selectedCategories: selectedCategories.map((c) => ({
        ...c,
        schemaNode: getSchemaNode(c.id),
      })),
    });
  };

  const refinePanelControls: RefinePanelControl[] = [
    {
      idSuffix: "CollectionSelector",
      title: collectionSelectorTitle,
      component: (
        <CollectionSelector
          onError={handleError}
          onSelectionChange={handleCollectionSelectionChanged}
          value={searchPageOptions.collections}
        />
      ),
      disabled: false,
      alwaysVisible: true,
    },
    {
      idSuffix: "AdvancedSearchSelector",
      title: searchStrings.advancedSearchSelector.title,
      component: (
        <AuxiliarySearchSelector
          auxiliarySearchesSupplier={getAdvancedSearchesFromServer}
          urlGeneratorForRouteLink={routes.AdvancedSearch.to}
          urlGeneratorForMuiLink={buildSelectionSessionAdvancedSearchLink}
        />
      ),
      disabled: false,
      alwaysVisible: true,
    },
    {
      idSuffix: "RemoteSearchSelector",
      title: searchStrings.remoteSearchSelector.title,
      component: (
        <AuxiliarySearchSelector
          auxiliarySearchesSupplier={getRemoteSearchesFromServer}
          urlGeneratorForRouteLink={routes.RemoteSearch.to}
          urlGeneratorForMuiLink={buildSelectionSessionRemoteSearchLink}
        />
      ),
      disabled: false,
    },
    {
      idSuffix: "DateRangeSelector",
      title: dateModifiedSelectorTitle,
      component: (
        <DateRangeSelector
          onDateRangeChange={handleLastModifiedDateRangeChange}
          onQuickModeChange={handleQuickDateRangeModeChange}
          quickOptionDropdownLabel={quickOptionDropdown}
          dateRange={searchPageOptions.lastModifiedDateRange}
          quickModeEnabled={searchPageOptions.dateRangeQuickModeEnabled}
        />
      ),
      // Before Search settings are retrieved, do not show.
      disabled: searchSettings?.searchingDisableDateModifiedFilter ?? true,
    },
    {
      idSuffix: "OwnerSelector",
      title: searchStrings.filterOwner.title,
      component: (
        <OwnerSelector
          onClearSelect={handleOwnerClear}
          onSelect={handleOwnerChange}
          value={searchPageOptions.owner}
        />
      ),
      disabled: searchSettings?.searchingDisableOwnerFilter ?? true,
    },
    {
      idSuffix: "StatusSelector",
      title: searchStrings.statusSelector.title,
      component: (
        <StatusSelector
          onChange={handleStatusChange}
          value={searchPageOptions.status}
        />
      ),
      disabled: !searchSettings?.searchingShowNonLiveCheckbox ?? true,
    },
    {
      idSuffix: "SearchAttachmentsSelector",
      title: searchStrings.searchAttachmentsSelector.title,
      component: (
        <SearchAttachmentsSelector
          value={searchPageOptions.searchAttachments}
          onChange={handleSearchAttachmentsChange}
        />
      ),
      disabled: false,
    },
  ];

  const renderClassifications = () => {
    if (
      state.status === "success" &&
      state.classifications.length > 0 &&
      state.classifications.some((c) => c.categories.length > 0)
    ) {
      return (
        <Grid item>
          <Card>
            <CardContent>
              <Typography variant="h5">
                {languageStrings.searchpage.categorySelector.title}
              </Typography>
              <CategorySelector
                classifications={state.classifications}
                onSelectedCategoriesChange={handleSelectedCategoriesChange}
                selectedCategories={searchPageOptions.selectedCategories}
              />
            </CardContent>
          </Card>
        </Grid>
      );
    }

    return null;
  };

  const {
    available: totalCount,
    highlight: highlights,
    results: searchResults,
  } = state.status === "success" ? state.result : defaultPagedSearchResult;
  return (
    <>
      <Grid container spacing={2}>
        <Grid item xs={9}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <SearchBar
                query={searchPageOptions.query ?? ""}
                rawMode={searchPageOptions.rawMode}
                onQueryChange={handleQueryChanged}
                onRawModeChange={handleRawModeChanged}
                doSearch={() => search(searchPageOptions)}
              />
            </Grid>
            <Grid item xs={12}>
              <SearchResultList
                showSpinner={
                  state.status === "initialising" ||
                  state.status === "searching"
                }
                paginationProps={{
                  count: totalCount,
                  currentPage: searchPageOptions.currentPage,
                  rowsPerPage: searchPageOptions.rowsPerPage,
                  onPageChange: handlePageChanged,
                  onRowsPerPageChange: handleRowsPerPageChanged,
                }}
                orderSelectProps={{
                  value: searchPageOptions.sortOrder,
                  onChange: handleSortOrderChanged,
                }}
                onClearSearchOptions={handleClearSearchOptions}
                onCopySearchLink={handleCopySearch}
              >
                {searchResults.length > 0 &&
                  mapSearchResultItems(searchResults, handleError, highlights)}
              </SearchResultList>
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={3}>
          <Grid container direction="column" spacing={2}>
            <Grid item>
              <RefineSearchPanel
                controls={refinePanelControls}
                onChangeExpansion={handleCollapsibleFilterClick}
                panelExpanded={filterExpansion}
                showFilterIcon={areCollapsibleFiltersSet()}
              />
            </Grid>
            {renderClassifications()}
          </Grid>
        </Grid>
      </Grid>
      <MessageInfo
        open={showSearchCopiedSnackBar}
        onClose={() => setShowSearchCopiedSnackBar(false)}
        title={searchStrings.shareSearchConfirmationText}
        variant="success"
      />
    </>
  );
};

export default SearchPage;
