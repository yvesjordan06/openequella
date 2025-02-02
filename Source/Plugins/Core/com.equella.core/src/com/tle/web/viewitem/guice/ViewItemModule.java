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

package com.tle.web.viewitem.guice;

import com.tle.core.config.guice.PropertiesModule;
import com.tle.web.sections.equella.SectionAuditable.AuditLevel;
import com.tle.web.sections.equella.guice.SectionsModule;

public class ViewItemModule extends SectionsModule {
  @Override
  protected void configure() {
    install(new ViewItemPropsModule());
  }

  public static class ViewItemPropsModule extends PropertiesModule {
    @Override
    protected void configure() {
      bindProp("audit.level", AuditLevel.NONE.name());
    }

    @Override
    protected String getFilename() {

      return "/plugins/com.tle.web.viewitem/mandatory.properties"; //$NON-NLS-1$
    }
  }
}
