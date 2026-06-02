sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sap/ui/core/routing/HashChanger",
    "sap/m/MessageToast",
    "myapp/model/models",
    "myapp/model/apiClient"
], function (UIComponent, Device, HashChanger, MessageToast, models, apiClient) {
    "use strict";

    return UIComponent.extend("myapp.Component", {
        metadata: { manifest: "json" },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            this._iSessionTimeoutMs = 30 * 60 * 1000;
            this._iActivityWriteThrottleMs = 10 * 1000;
            this._iLastActivityWriteAt = 0;
            this._aSessionEvents = ["click", "keydown", "touchstart", "mousemove", "scroll"];
            this._fnOnUserActivity = this._onUserActivity.bind(this);

            this.setModel(models.createDeviceModel(), "device");
            this.setModel(models.createUserManagementModel(), "users");
            this.setModel(models.createSystemManagementModel(), "system");

            var oStatusOptions = models.createStatusOptionsModel();
            models.resolveStatusOptionsText(oStatusOptions, this.getModel("i18n").getResourceBundle());
            this.setModel(oStatusOptions, "statusOptions");

            var oUserModel = models.createUserModel();
            this.setModel(oUserModel, "user");
            this._configureApiClient();
            this._normalizeSessionState();
            this._attachSessionActivityListeners();

            this._bootstrapUsersRbacData();

            var oRouter = this.getRouter();
            oRouter.attachBeforeRouteMatched(this._onBeforeRouteMatched, this);
            this._syncInitialHashWithSession();
            oRouter.initialize();
        },

        exit: function () {
            this._detachSessionActivityListeners();
        },

        _normalizeSessionState: function () {
            var oUserModel = this.getModel("user");
            var oCurrentUser = oUserModel && oUserModel.getProperty("/currentUser");

            if (!oCurrentUser || !oCurrentUser.username || !oCurrentUser.token) {
                return;
            }

            if (!oCurrentUser.tokenExpiry) {
                oCurrentUser.tokenExpiry = Date.now() + this._iSessionTimeoutMs;
                oCurrentUser.lastActivityAt = Date.now();
                oUserModel.setProperty("/currentUser", oCurrentUser);
                localStorage.setItem("currentUser", JSON.stringify(oCurrentUser));
            }
        },

        _syncInitialHashWithSession: function () {
            var sHash = HashChanger.getInstance().getHash() || "";
            var oUserModel = this.getModel("user");
            var oCurrentUser = oUserModel && oUserModel.getProperty("/currentUser");

            if (this._isUserValid(oCurrentUser)) {
                if (!sHash || sHash === "login") {
                    HashChanger.getInstance().replaceHash("home");
                }
                return;
            }

            if (sHash !== "login") {
                HashChanger.getInstance().replaceHash("login");
            }
        },

        _onBeforeRouteMatched: function (oEvent) {
            var oUserModel = this.getModel("user");
            var oCurrentUser = oUserModel && oUserModel.getProperty("/currentUser");
            var sRoute = oEvent.getParameter("name");

            var bUserIsValid = this._isUserValid(oCurrentUser);
            if (!bUserIsValid) {
                this._clearCurrentUser();
                oEvent.preventDefault();
                this.getRouter().navTo("RouteLogin", {}, true);
                return;
            }

            this._touchSession(false);

            if (sRoute === "RouteApp" || sRoute === "RouteLogin") {
                oEvent.preventDefault();
                this.getRouter().navTo("RouteHome", {}, true);
            }
        },

        _attachSessionActivityListeners: function () {
            var that = this;
            this._aSessionEvents.forEach(function (sEventName) {
                window.addEventListener(sEventName, that._fnOnUserActivity, true);
            });
        },

        _detachSessionActivityListeners: function () {
            var that = this;
            if (!this._fnOnUserActivity || !this._aSessionEvents) {
                return;
            }
            this._aSessionEvents.forEach(function (sEventName) {
                window.removeEventListener(sEventName, that._fnOnUserActivity, true);
            });
        },

        _onUserActivity: function () {
            var oUserModel = this.getModel("user");
            var oCurrentUser = oUserModel && oUserModel.getProperty("/currentUser");
            if (!oCurrentUser) {
                return;
            }

            if (!this._isUserValid(oCurrentUser)) {
                this._clearCurrentUser();
                MessageToast.show("登录已过期，请重新登录");
                this.getRouter().navTo("RouteLogin", {}, true);
                return;
            }

            this._touchSession(true);
        },

        _touchSession: function (bThrottleWrite) {
            var oUserModel = this.getModel("user");
            var oCurrentUser = oUserModel && oUserModel.getProperty("/currentUser");
            if (!oCurrentUser) {
                return;
            }

            var iNow = Date.now();
            if (bThrottleWrite && this._iLastActivityWriteAt && iNow - this._iLastActivityWriteAt < this._iActivityWriteThrottleMs) {
                return;
            }

            oCurrentUser.lastActivityAt = iNow;
            oCurrentUser.tokenExpiry = iNow + this._iSessionTimeoutMs;
            oUserModel.setProperty("/currentUser", oCurrentUser);
            localStorage.setItem("currentUser", JSON.stringify(oCurrentUser));
            this._iLastActivityWriteAt = iNow;
        },

        _clearCurrentUser: function () {
            var oUserModel = this.getModel("user");
            if (oUserModel) {
                oUserModel.setProperty("/currentUser", null);
            }
            localStorage.removeItem("currentUser");
        },

        _configureApiClient: function () {
            var that = this;
            apiClient.configure({
                tokenProvider: function () {
                    var oUserModel = that.getModel("user");
                    var oCurrentUser = oUserModel && oUserModel.getProperty("/currentUser");
                    return oCurrentUser && oCurrentUser.token ? oCurrentUser.token : "";
                },
                tokenUpdater: function (sToken, oUser) {
                    var oUserModel = that.getModel("user");
                    var oCurrentUser = (oUserModel && oUserModel.getProperty("/currentUser")) || {};
                    oCurrentUser.token = sToken;
                    if (oUser) {
                        oCurrentUser.username = oUser.username || oCurrentUser.username;
                        oCurrentUser.name = oUser.name || oCurrentUser.name;
                        oCurrentUser.role = oUser.role || oCurrentUser.role;
                    }
                    oCurrentUser.tokenExpiry = Date.now() + 30 * 60 * 1000;
                    oUserModel.setProperty("/currentUser", oCurrentUser);
                    localStorage.setItem("currentUser", JSON.stringify(oCurrentUser));
                },
                onUnauthorized: function () {
                    that._clearCurrentUser();
                    MessageToast.show("登录已过期，请重新登录");
                    that.getRouter().navTo("RouteLogin", {}, true);
                }
            });
        },

        _bootstrapUsersRbacData: function () {
            var oUserModel = this.getModel("user");
            var oCurrentUser = oUserModel && oUserModel.getProperty("/currentUser");
            if (!this._isUserValid(oCurrentUser)) {
                return;
            }

            var oUsersModel = this.getModel("users");
            if (!oUsersModel) {
                return;
            }

            Promise.all([
                apiClient.request("/api/rbac/menu-catalog"),
                apiClient.request("/api/rbac/roles"),
                apiClient.request("/api/users")
            ]).then(function (results) {
                var aCatalog = Array.isArray(results[0]) ? results[0] : [];
                var aRoles = Array.isArray(results[1]) ? results[1] : [];
                var aUsers = Array.isArray(results[2]) ? results[2] : [];

                oUsersModel.setProperty("/permissionCatalog", aCatalog);
                oUsersModel.setProperty("/roles", aRoles.map(function (oRole) {
                    return {
                        id: oRole.id,
                        name: oRole.name,
                        description: oRole.description || "",
                        userCount: Number(oRole.userCount || 0),
                        permissions: oRole.permissions || {}
                    };
                }));

                var roleNameMap = {};
                (oUsersModel.getProperty("/roles") || []).forEach(function (oRole) {
                    roleNameMap[oRole.id] = oRole.name;
                });

                oUsersModel.setProperty("/registeredUsers", aUsers.map(function (u) {
                    var sStatus = u.status || "ACTIVE";
                    return {
                        id: u.id,
                        username: u.username,
                        email: u.email || "",
                        phone: u.phone || "",
                        registrationDate: (u.createdAt || "").slice(0, 10),
                        status: sStatus,
                        statusState: sStatus === "ACTIVE" ? "Success" : "Warning",
                        accountStatus: sStatus === "DISABLED" ? "DISABLED" : "ENABLED",
                        accountStatusState: sStatus === "DISABLED" ? "Error" : "Success",
                        activityStatus: sStatus === "ACTIVE" ? "ACTIVE" : "INACTIVE",
                        activityStatusState: sStatus === "ACTIVE" ? "Success" : "Warning",
                        department: u.department || "",
                        roleId: u.role,
                        roleName: roleNameMap[u.role] || u.role || "",
                        role: roleNameMap[u.role] || u.role || ""
                    };
                }));
            }).catch(function () {
                // Keep app usable even when RBAC bootstrap fails.
            });
        },

        _isUserValid: function (oCurrentUser) {
            if (!oCurrentUser || !oCurrentUser.username || !oCurrentUser.token) {
                return false;
            }
            return (oCurrentUser.tokenExpiry || 0) > Date.now();
        }
    });
});