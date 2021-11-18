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
import * as OEQ from "@openequella/rest-api-client";
import * as E from "fp-ts/Either";
import { contramap, Eq } from "fp-ts/Eq";
import { flow, pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import { not } from "fp-ts/Predicate";
import * as RA from "fp-ts/ReadonlyArray";
import * as RR from "fp-ts/ReadonlyRecord";
import { ReadonlyRecord } from "fp-ts/ReadonlyRecord";
import * as RSET from "fp-ts/ReadonlySet";
import * as R from "fp-ts/Record";
import * as Semigroup from "fp-ts/Semigroup";
import * as Separated from "fp-ts/Separated";
import * as S from "fp-ts/string";
import * as TE from "fp-ts/TaskEither";
import { API_BASE_URL } from "../AppConfig";
import { OrdAsIs } from "../util/Ord";

/**
 * Eq for `OEQ.UserQuery.UserDetails` with equality based on the user's UUID.
 */
export const eqUserById: Eq<OEQ.UserQuery.UserDetails> = contramap(
  (user: OEQ.UserQuery.UserDetails) => user.id
)(S.Eq);

/**
 * Given a set of `OEQ.UserQuery.UserDetails`, return a set of UUIDs for all the users.
 */
export const userIds: (
  a: ReadonlySet<OEQ.UserQuery.UserDetails>
) => ReadonlySet<string> = flow(RSET.map(S.Eq)(({ id }) => id));

/**
 * List users known in oEQ. Useful for filtering by users, or assigning permissions etc.
 *
 * @param query A wildcard supporting string to filter the result based on name
 */
export const listUsers = (
  query?: string
): Promise<OEQ.UserQuery.UserDetails[]> =>
  OEQ.UserQuery.search(API_BASE_URL, {
    q: query,
    users: true,
    groups: false,
    roles: false,
  }).then((result: OEQ.UserQuery.SearchResult) => result.users);

/**
 * Gets the current user's info from the server as OEQ.LegacyContent.CurrentUserDetails.
 */
export const getCurrentUserDetails = () =>
  OEQ.LegacyContent.getCurrentUserDetails(API_BASE_URL).then(
    (result: OEQ.LegacyContent.CurrentUserDetails) => result
  );

/**
 * Lookup users known in oEQ.
 *
 * @param ids An array of oEQ ids
 */
export const resolveUsers = (
  ids: ReadonlyArray<string>
): Promise<OEQ.UserQuery.UserDetails[]> =>
  OEQ.UserQuery.lookup(API_BASE_URL, {
    users: RA.toArray<string>(ids),
    groups: [],
    roles: [],
  }).then((result: OEQ.UserQuery.SearchResult) => result.users);

/**
 * Find a user's details by ID.
 *
 * @param userId The unique ID of a user
 */
export const findUserById = async (
  userId: string
): Promise<OEQ.UserQuery.UserDetails | undefined> => {
  const userDetails = await resolveUsers([userId]);
  if (userDetails.length > 1)
    throw new Error(`More than one user was resolved for id: ${userId}`);
  return userDetails[0];
};

export type UserCache = ReadonlyRecord<string, OEQ.UserQuery.UserDetails>;

/**
 * Returns a function which can be used to retrieve user details (like `resolveUsers`) but using
 * a cache where possible.
 *
 * @param cache A cache update from previous calls, or initially simply `{}`
 * @param setCache A function which will be called if any updates where made which should trigger
 *                 an updated version of the cache. Typically this will occur if additional user
 *                 details had to be fetched. However if no additional details were required, then
 *                 no update to cache will be made and this function wont be called.
 * @param resolver a function (such as `resolveUsers`) which can make a call to the server to fetch
 *                 the details of any unknown user ids.
 */
export const resolveUsersCached =
  (
    cache: UserCache,
    setCache: (c: UserCache) => void,
    resolver: (
      ids: ReadonlyArray<string>
    ) => Promise<OEQ.UserQuery.UserDetails[]>
  ) =>
  (
    users: ReadonlySet<string>
  ): TE.TaskEither<string, ReadonlySet<OEQ.UserQuery.UserDetails>> => {
    const updateCache = (
      newUsers: ReadonlyArray<OEQ.UserQuery.UserDetails>
    ): ReadonlyArray<OEQ.UserQuery.UserDetails> => {
      const magmaLast = Semigroup.last<OEQ.UserQuery.UserDetails>();

      pipe(
        newUsers,
        (xs): UserCache =>
          RR.fromFoldableMap(magmaLast, RA.Foldable)(
            xs,
            (x: OEQ.UserQuery.UserDetails) => [x.id, x]
          ),
        // Before updating the cache, just be sure there is an update required
        O.fromPredicate(not(RR.isEmpty)),
        O.map(flow(RR.union(magmaLast)(cache), setCache))
      );

      return newUsers;
    };

    const retrieveUserDetails: (
      userIds: ReadonlySet<string>
    ) => TE.TaskEither<string, ReadonlySet<OEQ.UserQuery.UserDetails>> = flow(
      RSET.toReadonlyArray<string>(OrdAsIs),
      (ids) =>
        TE.tryCatch<string, OEQ.UserQuery.UserDetails[]>(
          () => resolver(ids),
          (reason) => `Failed to retrieve users: ${reason}`
        ),
      TE.map(updateCache),
      TE.map(RSET.fromReadonlyArray(eqUserById))
    );

    return pipe(
      users,
      RSET.partitionMap<string, OEQ.UserQuery.UserDetails>(
        S.Eq,
        eqUserById
      )((id) =>
        pipe(
          cache,
          R.lookup(id),
          E.fromOption(() => id)
        )
      ),
      // We now have previously cached users on the `right`, and on the `left` we potentially have
      // users we need to go and retrieve
      Separated.mapLeft<
        ReadonlySet<string>,
        TE.TaskEither<string, ReadonlySet<OEQ.UserQuery.UserDetails>>
      >(
        flow(
          O.fromPredicate(not(RSET.isEmpty)),
          O.map(retrieveUserDetails),
          O.getOrElse(() =>
            TE.right<string, ReadonlySet<OEQ.UserQuery.UserDetails>>(new Set())
          )
        )
      ),
      // Now merge the cached users with those retrieved
      ({ left: retrievalResult, right: cachedUsers }) =>
        pipe(retrievalResult, TE.map(RSET.union(eqUserById)(cachedUsers)))
    );
  };
