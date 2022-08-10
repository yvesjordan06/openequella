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
import { TextField } from "@material-ui/core";
import { Autocomplete } from "@material-ui/lab";
import { useContext } from "react";
import * as React from "react";
import { AppContext } from "../../mainui/App";
import { guestUser } from "../../modules/UserModule";
import { languageStrings } from "../../util/langstrings";
import { MyResourcesType } from "../MyResourcesPageHelper";

export interface MyResourcesSelectorProps {
  /**
   * Initially selected My resources type.
   */
  value: MyResourcesType;
  /**
   * Handler for selecting a different resource type.
   */
  onChange: (resourceType: MyResourcesType) => void;
}

const { title } = languageStrings.myResources;

const defaultOptions: MyResourcesType[] = [
  "Published",
  "Drafts",
  "Scrapbook",
  "Moderation queue",
  "Archive",
  "All resources",
];

/**
 * This component displays My resources types and the selection of each type
 * triggers a search. This component should be used under 'MyResourcesPageContext'.
 */
export const MyResourcesSelector = ({
  value,
  onChange,
}: MyResourcesSelectorProps) => {
  const { scrapbookEnabled } = useContext(AppContext).currentUser ?? guestUser;

  // When access to Scrapbook is not enabled, drop the option of Scrapbook.
  const options: MyResourcesType[] = defaultOptions.filter(
    (s) => scrapbookEnabled || s !== "Scrapbook"
  );

  return (
    <Autocomplete
      value={value}
      options={options}
      disableClearable
      onChange={(_, selected: MyResourcesType) => {
        onChange(selected);
      }}
      getOptionSelected={(option, selected) => selected === option}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="outlined"
          label={title}
          placeholder={title}
        />
      )}
    />
  );
};
