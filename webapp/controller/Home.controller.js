sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "myapp/model/apiClient"
], function (Controller, JSONModel, apiClient) {
    "use strict";

    return Controller.extend("myapp.controller.Home", {
        onInit: function () {
            var oUserModel = this.getOwnerComponent().getModel("user");
            var oCurrentUser = oUserModel && oUserModel.getProperty("/currentUser");
            if (!oCurrentUser || !oCurrentUser.username) {
                this.getOwnerComponent().getRouter().navTo("RouteLogin", {}, true);
                return;
            }

            var sSavedLang = localStorage.getItem("app-language");
            var sCurrentLang = ((sSavedLang || "ZH").toUpperCase().startsWith("EN")) ? "EN" : "ZH";

            this.getView().setModel(new JSONModel({
                activeMenuKey: "",
                currentLang: sCurrentLang,
                menuVisibility: {
                    profile: true,
                    users: true,
                    roles: true,
                    permissionManagement: true,
                    system: true,
                    governanceGroup: true,
                    messageCenterGroup: true,
                    dataSourceManagement: true,
                    schedulerManagement: true,
                    notifyChannelManagement: true
                }
            }), "view");

            this._oDashboardModel = new JSONModel({
                welcomeTitle: "",
                welcomeSubtitle: "",
                todayText: "",
                focusText: "",
                summaryCards: [],
                todoCards: [],
                alerts: [],
                quickActions: [],
                statusOverview: [],
                deliveryStatus: [],
                invoiceStatus: [],
                topSuppliers: [],
                activities: []
            });
            this.getView().setModel(this._oDashboardModel, "dashboard");

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteHome").attachPatternMatched(this._onHomeMatched, this);

            this._applyMenuAuthorization();
            this._refreshDashboard();
        },

        _onHomeMatched: function () {
            this._applyMenuAuthorization();
            this._refreshDashboard();
        },

        onLanguageToggle: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            localStorage.setItem("app-language", sKey);
            window.location.reload();
        },

        onLogout: function () {
            var oUserModel = this.getOwnerComponent().getModel("user");
            if (oUserModel) {
                oUserModel.setProperty("/currentUser", null);
            }
            localStorage.removeItem("currentUser");
            this.getOwnerComponent().getRouter().navTo("RouteLogin", {}, true);
        },

        onNavigateToProfile: function () {
            this._setActiveMenuKey("profile");
            this.getOwnerComponent().getRouter().navTo("RouteProfile");
        },

        onNavigateToUserManagement: function () {
            this._setActiveMenuKey("users");
            this.getOwnerComponent().getRouter().navTo("RouteUserManagementTab", { tab: "users" });
        },

        onNavigateToRoleManagement: function () {
            this._setActiveMenuKey("roles");
            this.getOwnerComponent().getRouter().navTo("RouteUserManagementTab", { tab: "roles" });
        },

        onNavigateToPermissionManagement: function () {
            this._setActiveMenuKey("permissionManagement");
            this.getOwnerComponent().getRouter().navTo("RouteUserManagementTab", { tab: "permissions" });
        },

        onNavigateToSystemManagement: function () {
            this._setActiveMenuKey("system");
            this.getOwnerComponent().getRouter().navTo("RouteSystemManagement");
        },

        onNavigateToDataSourceManagement: function () {
            this._setActiveMenuKey("dataSourceManagement");
            this.getOwnerComponent().getRouter().navTo("RouteDataSourceManagement");
        },

        onNavigateToSchedulerManagement: function () {
            this._setActiveMenuKey("schedulerManagement");
            this.getOwnerComponent().getRouter().navTo("RouteSchedulerManagement");
        },

        onNavigateToNotifyChannelManagement: function () {
            this._setActiveMenuKey("notifyChannelManagement");
            this.getOwnerComponent().getRouter().navTo("RouteNotifyChannelManagement");
        },

        _setActiveMenuKey: function (sKey) {
            this.getView().getModel("view").setProperty("/activeMenuKey", sKey || "");
        },

        _applyMenuAuthorization: function () {
            var oViewModel = this.getView().getModel("view");
            var oUserModel = this.getOwnerComponent().getModel("user");
            var oUsersModel = this.getOwnerComponent().getModel("users");
            var oCurrentUser = oUserModel && oUserModel.getProperty("/currentUser");
            var aRegisteredUsers = oUsersModel.getProperty("/registeredUsers") || [];
            var aRoles = oUsersModel.getProperty("/roles") || [];
            var oRegisteredUser = aRegisteredUsers.find(function (oItem) {
                return oCurrentUser && oItem.username === oCurrentUser.username;
            });
            var oRole = aRoles.find(function (oItem) {
                return oRegisteredUser && oItem.id === oRegisteredUser.roleId;
            });
            if (!oRole && oCurrentUser && oCurrentUser.role) {
                oRole = aRoles.find(function (oItem) {
                    return oItem.id === oCurrentUser.role;
                });
            }
            var bIsAdmin = !!(oCurrentUser && (oCurrentUser.role === "ROLE_ADMIN" || oCurrentUser.role === "ADMIN"));
            var oPermissions = oRole && oRole.permissions ? oRole.permissions : {};
            var fnCanQuery = function (sModule) {
                if (bIsAdmin) {
                    return true;
                }
                return !!(oPermissions[sModule] && oPermissions[sModule].query);
            };
            var oVisibility = {
                profile: true,
                users: fnCanQuery("users"),
                roles: fnCanQuery("roles"),
                permissionManagement: fnCanQuery("permissionManagement"),
                system: fnCanQuery("system"),
                dataSourceManagement: fnCanQuery("dataSourceManagement"),
                schedulerManagement: fnCanQuery("schedulerManagement"),
                notifyChannelManagement: fnCanQuery("notifyChannelManagement")
            };

            oVisibility.governanceGroup = oVisibility.profile || oVisibility.users || oVisibility.roles || oVisibility.permissionManagement || oVisibility.system;
            oVisibility.messageCenterGroup = oVisibility.dataSourceManagement || oVisibility.schedulerManagement || oVisibility.notifyChannelManagement;

            oViewModel.setProperty("/menuVisibility", oVisibility);
        },

        onDashboardRoutePress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("dashboard");
            var oItem = oContext && oContext.getObject();

            if (!oItem || !oItem.route) {
                return;
            }

            this.getOwnerComponent().getRouter().navTo(oItem.route, oItem.params || {});
        },

        onAlertPress: function (oEvent) {
            this.onDashboardRoutePress(oEvent);
        },

        _refreshDashboard: function () {
            var that = this;
            var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            var oUserModel = this.getOwnerComponent().getModel("user");
            var oCurrentUser = oUserModel && oUserModel.getProperty("/currentUser");

            Promise.all([
                apiClient.request("/api/datasource").catch(function () { return []; }),
                apiClient.request("/api/datasource/query-templates/list").catch(function () { return []; }),
                apiClient.request("/api/notify/channels").catch(function () { return []; }),
                apiClient.request("/api/scheduler/tasks").catch(function () { return []; })
            ]).then(function (aResults) {
                var aDataSources = Array.isArray(aResults[0]) ? aResults[0] : [];
                var aTemplates = Array.isArray(aResults[1]) ? aResults[1] : [];
                var aChannels = Array.isArray(aResults[2]) ? aResults[2] : [];
                var aTasks = Array.isArray(aResults[3]) ? aResults[3] : [];

                var iActiveTasks = aTasks.filter(function (oTask) { return oTask.status === "ACTIVE"; }).length;
                var iPausedTasks = aTasks.filter(function (oTask) { return oTask.status === "PAUSED"; }).length;
                var iFailedTasks = aTasks.filter(function (oTask) { return oTask.lastRunStatus === "FAILED"; }).length;
                var iNeverRunTasks = aTasks.filter(function (oTask) { return !oTask.lastRunAt; }).length;
                var iUnconfiguredChannels = aChannels.filter(function (oChannel) {
                    return that._isPlaceholderChannelConfig(oChannel.configJson);
                }).length;

                that._oDashboardModel.setData({
                    welcomeTitle: oBundle.getText("mcHomeWelcomeTitle"),
                    welcomeSubtitle: oBundle.getText("mcHomeWelcomeSubtitle", [((oCurrentUser && (oCurrentUser.name || oCurrentUser.username)) || oBundle.getText("defaultUserName"))]),
                    todayText: that._formatTodayText(),
                    focusText: oBundle.getText("mcHomeFocusText", [iActiveTasks, iFailedTasks, iUnconfiguredChannels]),
                    summaryCards: [
                        {
                            title: oBundle.getText("mcCardDataSourceTitle"),
                            value: String(aDataSources.length),
                            description: oBundle.getText("mcCardDataSourceDesc"),
                            icon: "sap-icon://database",
                            route: "RouteDataSourceManagement"
                        },
                        {
                            title: oBundle.getText("mcCardTemplateTitle"),
                            value: String(aTemplates.length),
                            description: oBundle.getText("mcCardTemplateDesc"),
                            icon: "sap-icon://source-code",
                            route: "RouteDataSourceManagement"
                        },
                        {
                            title: oBundle.getText("mcCardChannelTitle"),
                            value: String(aChannels.length),
                            description: oBundle.getText("mcCardChannelDesc", [iUnconfiguredChannels]),
                            icon: "sap-icon://bell",
                            route: "RouteNotifyChannelManagement"
                        },
                        {
                            title: oBundle.getText("mcCardTaskTitle"),
                            value: String(iActiveTasks),
                            description: oBundle.getText("mcCardTaskDesc", [aTasks.length]),
                            icon: "sap-icon://appointment-2",
                            route: "RouteSchedulerManagement"
                        }
                    ],
                    todoCards: [
                        {
                            title: oBundle.getText("mcTodoFailedTaskTitle"),
                            value: String(iFailedTasks),
                            subtitle: oBundle.getText("mcTodoFailedTaskSubtitle"),
                            statusText: iFailedTasks > 0 ? oBundle.getText("mcTodoNeedHandle") : oBundle.getText("mcTodoAllHealthy"),
                            statusState: iFailedTasks > 0 ? "Error" : "Success",
                            route: "RouteSchedulerManagement"
                        },
                        {
                            title: oBundle.getText("mcTodoPausedTaskTitle"),
                            value: String(iPausedTasks),
                            subtitle: oBundle.getText("mcTodoPausedTaskSubtitle"),
                            statusText: iPausedTasks > 0 ? oBundle.getText("mcTodoNeedReview") : oBundle.getText("mcTodoNoPaused"),
                            statusState: iPausedTasks > 0 ? "Warning" : "Success",
                            route: "RouteSchedulerManagement"
                        },
                        {
                            title: oBundle.getText("mcTodoUnconfiguredChannelTitle"),
                            value: String(iUnconfiguredChannels),
                            subtitle: oBundle.getText("mcTodoUnconfiguredChannelSubtitle"),
                            statusText: iUnconfiguredChannels > 0 ? oBundle.getText("mcTodoNeedConfig") : oBundle.getText("mcTodoChannelsReady"),
                            statusState: iUnconfiguredChannels > 0 ? "Warning" : "Success",
                            route: "RouteNotifyChannelManagement"
                        },
                        {
                            title: oBundle.getText("mcTodoNeverRunTaskTitle"),
                            value: String(iNeverRunTasks),
                            subtitle: oBundle.getText("mcTodoNeverRunTaskSubtitle"),
                            statusText: iNeverRunTasks > 0 ? oBundle.getText("mcTodoNeedFirstRun") : oBundle.getText("mcTodoRunBaselineReady"),
                            statusState: iNeverRunTasks > 0 ? "Information" : "Success",
                            route: "RouteSchedulerManagement"
                        }
                    ],
                    alerts: that._buildMessageCenterAlerts(aDataSources, aChannels, iFailedTasks, iUnconfiguredChannels),
                    quickActions: [
                        { title: oBundle.getText("mcQuickActionDataSourceTitle"), description: oBundle.getText("mcQuickActionDataSourceDesc"), icon: "sap-icon://database", route: "RouteDataSourceManagement" },
                        { title: oBundle.getText("mcQuickActionTemplateTitle"), description: oBundle.getText("mcQuickActionTemplateDesc"), icon: "sap-icon://source-code", route: "RouteDataSourceManagement" },
                        { title: oBundle.getText("mcQuickActionTaskTitle"), description: oBundle.getText("mcQuickActionTaskDesc"), icon: "sap-icon://appointment-2", route: "RouteSchedulerManagement" },
                        { title: oBundle.getText("mcQuickActionChannelTitle"), description: oBundle.getText("mcQuickActionChannelDesc"), icon: "sap-icon://bell", route: "RouteNotifyChannelManagement" }
                    ],
                    statusOverview: that._buildTaskStatusOverview(aTasks),
                    deliveryStatus: that._buildChannelTypeOverview(aChannels),
                    invoiceStatus: that._buildTaskRunOverview(aTasks),
                    topSuppliers: that._buildTaskBoard(aTasks),
                    activities: that._buildMessageCenterActivities(aTasks, iUnconfiguredChannels)
                });
            }).catch(function () {
                that._oDashboardModel.setData({
                    welcomeTitle: oBundle.getText("mcHomeWelcomeTitle"),
                    welcomeSubtitle: oBundle.getText("mcHomeLoadFailed"),
                    todayText: that._formatTodayText(),
                    focusText: oBundle.getText("mcHomeFocusEmpty"),
                    summaryCards: [],
                    todoCards: [],
                    alerts: [],
                    quickActions: [],
                    statusOverview: [],
                    deliveryStatus: [],
                    invoiceStatus: [],
                    topSuppliers: [],
                    activities: []
                });
            });
        },

        _buildMessageCenterAlerts: function (aDataSources, aChannels, iFailedTasks, iUnconfiguredChannels) {
            var aAlerts = [];
            if (!aDataSources.length) {
                aAlerts.push({
                    title: this._getText("mcAlertNoDataSourceTitle"),
                    description: this._getText("mcAlertNoDataSourceDesc"),
                    info: this._getText("mcAlertDataSourceInfo"),
                    state: "Warning",
                    icon: "sap-icon://database",
                    route: "RouteDataSourceManagement"
                });
            }
            if (!aChannels.length) {
                aAlerts.push({
                    title: this._getText("mcAlertNoChannelTitle"),
                    description: this._getText("mcAlertNoChannelDesc"),
                    info: this._getText("mcAlertChannelInfo"),
                    state: "Warning",
                    icon: "sap-icon://bell",
                    route: "RouteNotifyChannelManagement"
                });
            }
            if (iUnconfiguredChannels > 0) {
                aAlerts.push({
                    title: this._getText("mcAlertUnconfiguredChannelTitle"),
                    description: this._getText("mcAlertUnconfiguredChannelDesc", [iUnconfiguredChannels]),
                    info: this._getText("mcAlertChannelInfo"),
                    state: "Information",
                    icon: "sap-icon://action-settings",
                    route: "RouteNotifyChannelManagement"
                });
            }
            if (iFailedTasks > 0) {
                aAlerts.push({
                    title: this._getText("mcAlertFailedTaskTitle"),
                    description: this._getText("mcAlertFailedTaskDesc", [iFailedTasks]),
                    info: this._getText("mcAlertTaskInfo"),
                    state: "Error",
                    icon: "sap-icon://error",
                    route: "RouteSchedulerManagement"
                });
            }
            if (!aAlerts.length) {
                aAlerts.push({
                    title: this._getText("mcAlertHealthyTitle"),
                    description: this._getText("mcAlertHealthyDesc"),
                    info: this._getText("mcAlertWorkbenchInfo"),
                    state: "Success",
                    icon: "sap-icon://status-positive",
                    route: "RouteHome"
                });
            }
            return aAlerts;
        },

        _buildTaskStatusOverview: function (aTasks) {
            var iTotal = aTasks.length || 1;
            var iActive = aTasks.filter(function (oTask) { return oTask.status === "ACTIVE"; }).length;
            var iPaused = aTasks.filter(function (oTask) { return oTask.status === "PAUSED"; }).length;
            return [
                {
                    label: this._getText("mcStatusTaskActive"),
                    count: iActive,
                    percentage: this._calcOverviewPercent(iActive, iTotal),
                    percentageText: this._calcOverviewPercent(iActive, iTotal) + "%",
                    state: "Success"
                },
                {
                    label: this._getText("mcStatusTaskPaused"),
                    count: iPaused,
                    percentage: this._calcOverviewPercent(iPaused, iTotal),
                    percentageText: this._calcOverviewPercent(iPaused, iTotal) + "%",
                    state: "Warning"
                }
            ];
        },

        _buildChannelTypeOverview: function (aChannels) {
            var iTotal = aChannels.length || 1;
            var iEmail = aChannels.filter(function (o) { return o.type === "EMAIL"; }).length;
            var iDingTalk = aChannels.filter(function (o) { return o.type === "DINGTALK"; }).length;
            var iWeCom = aChannels.filter(function (o) { return o.type === "WECOM"; }).length;
            return [
                { label: this._getText("mcStatusChannelEmail"), count: iEmail, state: "Information" },
                { label: this._getText("mcStatusChannelDingTalk"), count: iDingTalk, state: "Success" },
                { label: this._getText("mcStatusChannelWeCom"), count: iWeCom, state: "Warning" }
            ].map(function (oItem) {
                var iPercent = this._calcOverviewPercent(oItem.count, iTotal);
                return Object.assign({}, oItem, {
                    percentage: iPercent,
                    percentageText: iPercent + "%"
                });
            }, this).sort(function (a, b) {
                return b.count - a.count;
            });
        },

        _buildTaskRunOverview: function (aTasks) {
            var iTotal = aTasks.length || 1;
            var iSuccess = aTasks.filter(function (o) { return o.lastRunStatus === "SUCCESS"; }).length;
            var iFailed = aTasks.filter(function (o) { return o.lastRunStatus === "FAILED"; }).length;
            var iUnknown = aTasks.filter(function (o) { return !o.lastRunStatus; }).length;
            return [
                {
                    label: this._getText("mcStatusRunSuccess"),
                    count: iSuccess,
                    percentage: this._calcOverviewPercent(iSuccess, iTotal),
                    percentageText: this._calcOverviewPercent(iSuccess, iTotal) + "%",
                    state: "Success"
                },
                {
                    label: this._getText("mcStatusRunFailed"),
                    count: iFailed,
                    percentage: this._calcOverviewPercent(iFailed, iTotal),
                    percentageText: this._calcOverviewPercent(iFailed, iTotal) + "%",
                    state: "Error"
                },
                {
                    label: this._getText("mcStatusRunUnknown"),
                    count: iUnknown,
                    percentage: this._calcOverviewPercent(iUnknown, iTotal),
                    percentageText: this._calcOverviewPercent(iUnknown, iTotal) + "%",
                    state: "None"
                }
            ];
        },

        _calcOverviewPercent: function (iCount, iTotal) {
            if (!iCount || iTotal <= 0) {
                return 0;
            }
            return Math.max(6, Math.round((iCount / iTotal) * 100));
        },

        _buildTaskBoard: function (aTasks) {
            return (aTasks || []).map(function (oTask) {
                return {
                    name: oTask.name,
                    contacts: oTask.cronExpr || "-",
                    value: this._formatLastRunText(oTask.lastRunAt),
                    status: oTask.status === "ACTIVE" ? this._getText("mcTaskStatusRunning") : this._getText("mcTaskStatusPaused"),
                    state: oTask.status === "ACTIVE" ? "Success" : "Warning"
                };
            }, this).sort(function (a, b) {
                return (b.value || "").localeCompare(a.value || "");
            }).slice(0, 6);
        },

        _buildMessageCenterActivities: function (aTasks, iUnconfiguredChannels) {
            var aActivities = [];
            var iFailed = aTasks.filter(function (oTask) { return oTask.lastRunStatus === "FAILED"; }).length;
            var iActive = aTasks.filter(function (oTask) { return oTask.status === "ACTIVE"; }).length;

            if (iFailed > 0) {
                aActivities.push({
                    title: this._getText("mcActivityFixFailedTaskTitle"),
                    description: this._getText("mcActivityFixFailedTaskDesc", [iFailed]),
                    icon: "sap-icon://error",
                    route: "RouteSchedulerManagement"
                });
            }
            if (iUnconfiguredChannels > 0) {
                aActivities.push({
                    title: this._getText("mcActivityConfigChannelTitle"),
                    description: this._getText("mcActivityConfigChannelDesc", [iUnconfiguredChannels]),
                    icon: "sap-icon://action-settings",
                    route: "RouteNotifyChannelManagement"
                });
            }
            if (iActive > 0) {
                aActivities.push({
                    title: this._getText("mcActivityCheckRunTitle"),
                    description: this._getText("mcActivityCheckRunDesc", [iActive]),
                    icon: "sap-icon://appointment-2",
                    route: "RouteSchedulerManagement"
                });
            }
            if (!aActivities.length) {
                aActivities.push({
                    title: this._getText("mcActivityBootstrapTitle"),
                    description: this._getText("mcActivityBootstrapDesc"),
                    icon: "sap-icon://hint",
                    route: "RouteDataSourceManagement"
                });
            }
            return aActivities;
        },

        _isPlaceholderChannelConfig: function (sConfigJson) {
            if (!sConfigJson) {
                return true;
            }
            return /REPLACE_ME|YOUR_TOKEN|YOUR_KEY|smtp\.example\.com/i.test(String(sConfigJson));
        },

        _formatLastRunText: function (sLastRunAt) {
            if (!sLastRunAt) {
                return this._getText("mcTaskNeverRun");
            }
            return new Date(sLastRunAt).toLocaleString("zh-CN");
        },

        _formatTodayText: function () {
            var aWeeks = [this._getText("weekSun"), this._getText("weekMon"), this._getText("weekTue"), this._getText("weekWed"), this._getText("weekThu"), this._getText("weekFri"), this._getText("weekSat")];
            var oNow = new Date();
            var sDate = oNow.getFullYear() + "-" + String(oNow.getMonth() + 1).padStart(2, "0") + "-" + String(oNow.getDate()).padStart(2, "0");
            return sDate + " " + aWeeks[oNow.getDay()];
        },

        _getText: function (sKey, aArgs) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        }
    });
});