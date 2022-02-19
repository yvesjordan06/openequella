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

package com.tle.core.viewcount.dao;

import com.tle.beans.Institution;
import com.tle.beans.item.ItemKey;
import com.tle.beans.viewcount.ViewcountAttachment;
import com.tle.beans.viewcount.ViewcountAttachmentId;
import com.tle.common.institution.CurrentInstitution;
import com.tle.core.guice.Bind;
import com.tle.core.hibernate.dao.GenericInstitionalDaoImpl;
import java.util.Optional;
import javax.inject.Singleton;

@Bind(AttachmentViewCountDao.class)
@Singleton
public class AttachmentViewCountDaoImpl
    extends GenericInstitionalDaoImpl<ViewcountAttachment, ViewcountAttachmentId>
    implements AttachmentViewCountDao {

  public AttachmentViewCountDaoImpl() {
    super(ViewcountAttachment.class);
  }

  @Override
  public int getAttachmentViewCountForCollection(long collectionId) {
    Long count =
        (Long)
            getHibernateTemplate()
                .execute(
                    session ->
                        session
                            .getNamedQuery("getAttachmentViewCountForCollection")
                            .setParameter("institutionId", CurrentInstitution.get().getDatabaseId())
                            .setParameter("collectionId", collectionId)
                            .uniqueResult());

    return Optional.ofNullable(count).map(Long::intValue).orElse(0);
  }

  @Override
  public void deleteAttachmentViewCountForItem(Institution institution, ItemKey itemKey) {
    getHibernateTemplate()
        .execute(
            session ->
                session
                    .getNamedQuery("deleteAttachmentViewCountForItem")
                    .setParameter("itemVersion", itemKey.getVersion())
                    .setParameter("itemUuid", itemKey.getUuid())
                    .setParameter("institutionId", institution.getDatabaseId())
                    .executeUpdate());
  }
}