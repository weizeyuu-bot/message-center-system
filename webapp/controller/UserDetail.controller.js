sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "myapp/model/apiClient"
], function (Controller, JSONModel, MessageToast, apiClient) {
    "use strict";

    return Controller.extend("myapp.controller.UserDetail", {

        onInit: function () {
            this._iUserIndex = -1;
            this._oEditSnapshot = null;

            this.getView().setModel(new JSONModel({ editMode: false }), "ui");

            // 将组件级 users 模型挂到视图，以便 bindElement 可以使用
            var oUsersModel = this.getOwnerComponent().getModel("users");
            this.getView().setModel(oUsersModel, "users");

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteUserDetail").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var sUsername = oEvent.getParameter("arguments").username;
            try {
                sUsername = decodeURIComponent(sUsername || "");
            } catch (e) {
                sUsername = sUsername || "";
            }

            var oUsersModel = this.getOwnerComponent().getModel("users");
            var aUsers = oUsersModel.getProperty("/registeredUsers") || [];
            var iUserIndex = aUsers.findIndex(function (oItem) {
                return oItem.username === sUsername;
            });

            if (iUserIndex < 0) {
                MessageToast.show(this._getText("userNotFoundByName", [sUsername]));
                this.getOwnerComponent().getRouter().navTo("RouteUserManagement");
                return;
            }

            this._iUserIndex = iUserIndex;
            this._oEditSnapshot = null;
            this.getView().getModel("ui").setProperty("/editMode", false);

            // 直接将视图绑定到 users 模型中对应行，数据自动显示
            this.getView().bindElement({
                path: "/registeredUsers/" + iUserIndex,
                model: "users"
            });
        },

        onEditUser: function () {
            var oUsersModel = this.getOwnerComponent().getModel("users");
            if (!oUsersModel || this._iUserIndex < 0) { return; }

            // 编辑前先快照，用于取消时恢复
            var oUser = oUsersModel.getProperty("/registeredUsers/" + this._iUserIndex);
            this._oEditSnapshot = Object.assign({}, oUser);
            this.getView().getModel("ui").setProperty("/editMode", true);
        },

        onCancelEdit: function () {
            if (this._oEditSnapshot && this._iUserIndex >= 0) {
                var oUsersModel = this.getOwnerComponent().getModel("users");
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex, Object.assign({}, this._oEditSnapshot));
            }
            this.getView().getModel("ui").setProperty("/editMode", false);
            this._oEditSnapshot = null;
        },

        onSaveUser: function () {
            if (this._iUserIndex < 0) {
                MessageToast.show(this._getText("userSaveMissingData"));
                return;
            }

            var oUsersModel = this.getOwnerComponent().getModel("users");
            var oUser = oUsersModel.getProperty("/registeredUsers/" + this._iUserIndex);

            if (!oUser.email || !oUser.phone || !oUser.department || !oUser.roleId) {
                MessageToast.show(this._getText("userFieldsRequired"));
                return;
            }
            if (!this._isValidEmail(oUser.email)) {
                MessageToast.show(this._getText("userEmailInvalid"));
                return;
            }
            if (!this._isValidPhone(oUser.phone)) {
                MessageToast.show(this._getText("userPhoneInvalid"));
                return;
            }

            var aRoles = oUsersModel.getProperty("/roles") || [];
            var oRole = aRoles.find(function (r) { return r.id === oUser.roleId; });
            if (oRole) {
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/roleName", oRole.name);
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/role", oRole.name);
            }

            apiClient.request("/api/users/" + encodeURIComponent(oUser.id), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: oUser.username,
                    email: (oUser.email || "").trim() || undefined,
                    phone: (oUser.phone || "").trim() || undefined,
                    department: (oUser.department || "").trim() || undefined,
                    role: oUser.roleId,
                    status: oUser.status
                })
            })
            .then(function (oSavedUser) {
                var sRoleId = this._mapBackendRoleToRoleId(oSavedUser.role);
                var sRoleName = this._getRoleNameById(sRoleId) || oSavedUser.role || "";

                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/email", oSavedUser.email || "");
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/phone", oSavedUser.phone || "");
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/department", oSavedUser.department || "");
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/roleId", sRoleId);
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/roleName", sRoleName);
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/role", sRoleName);
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/status", oSavedUser.status || "ACTIVE");
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/statusState",
                    this._mapStatusToState(oSavedUser.status));

                this._refreshUserStatistics(oUsersModel);
                this._oEditSnapshot = null;
                this.getView().getModel("ui").setProperty("/editMode", false);
                MessageToast.show(this._getText("saveSuccess"));
            }.bind(this))
            .catch(function (oError) {
                MessageToast.show(apiClient.getErrorMessage(oError, this._getText("saveFailed")));
            }.bind(this));
        },

        _isValidEmail: function (sEmail) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(sEmail || "").trim());
        },

        _isValidPhone: function (sPhone) {
            return /^\d{7,15}$/.test(String(sPhone || "").trim());
        },

        _refreshUserStatistics: function (oUsersModel) {
            var aUsers = oUsersModel.getProperty("/registeredUsers") || [];
            var iActive = aUsers.filter(function (oUser) {
                return oUser.status === "ACTIVE";
            }).length;
            var iInactive = aUsers.filter(function (oUser) {
                return oUser.status === "INACTIVE";
            }).length;

            oUsersModel.setProperty("/statistics/totalUsers", aUsers.length);
            oUsersModel.setProperty("/statistics/activeUsers", iActive);
            oUsersModel.setProperty("/statistics/inactiveUsers", iInactive);
        },

        _mapBackendRoleToRoleId: function (sRole) {
            if (!sRole || sRole === "USER") {
                return "ROLE_BUYER";
            }

            if (sRole === "ADMIN") {
                return "ROLE_ADMIN";
            }

            return sRole;
        },

        _getRoleNameById: function (sRoleId) {
            var aRoles = this.getOwnerComponent().getModel("users").getProperty("/roles") || [];
            var oRole = aRoles.find(function (oItem) {
                return oItem.id === sRoleId;
            });
            return oRole ? oRole.name : "";
        },

        onRoleChange: function (oEvent) {
            var sRoleId = oEvent.getSource().getSelectedKey();
            if (this._iUserIndex < 0) { return; }
            var oUsersModel = this.getOwnerComponent().getModel("users");
            var aRoles = oUsersModel.getProperty("/roles") || [];
            var oRole = aRoles.find(function (r) { return r.id === sRoleId; });
            if (oRole) {
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/roleName", oRole.name);
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/role", oRole.name);
            }
        },

        onStatusChange: function (oEvent) {
            var sStatus = oEvent.getSource().getSelectedKey();
            if (this._iUserIndex >= 0) {
                var oUsersModel = this.getOwnerComponent().getModel("users");
                oUsersModel.setProperty("/registeredUsers/" + this._iUserIndex + "/statusState",
                    this._mapStatusToState(sStatus));
            }
        },

        _mapStatusToState: function (sStatus) {
            if (sStatus === "ACTIVE") {
                return "Success";
            }
            if (sStatus === "INACTIVE") {
                return "Warning";
            }
            if (sStatus === "DISABLED") {
                return "Error";
            }
            return "None";
        },

        formatUserStatusText: function (sStatus) {
            var mKey = {
                ACTIVE: "statusActive",
                INACTIVE: "statusInactive",
                DISABLED: "statusDisabled"
            };
            return this._getText(mKey[sStatus] || "status");
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteUserManagement");
        },

        _getText: function (sKey, aArgs) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        }
    });
});