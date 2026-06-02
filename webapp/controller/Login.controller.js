sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "myapp/model/apiClient"
], function (Controller, MessageToast, JSONModel, apiClient) {
    "use strict";

    return Controller.extend("myapp.controller.Login", {

        onInit: function () {
            this.getView().setModel(new JSONModel({
                username: "admin",
                password: "Admin@123456",
                rememberMe: false
            }));

            var sSavedLang = localStorage.getItem("app-language");
            var sCurrentLang = ((sSavedLang || "ZH").toUpperCase().startsWith("EN")) ? "EN" : "ZH";
            this.getView().setModel(new JSONModel({ currentLang: sCurrentLang }), "view");
        },

        onLanguageToggle: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            localStorage.setItem("app-language", sKey);
            window.location.reload();
        },

        onLogin: function () {
            var sUsername = (this.getView().getModel().getProperty("/username") || "").toString().trim();
            var sPassword = (this.getView().getModel().getProperty("/password") || "").toString().trim();

            if (!sUsername || !sPassword) {
                MessageToast.show(this._getText("loginRequired"));
                return;
            }

            MessageToast.show(this._getText("loggingIn"));
            var oView = this.getView();
            var oUserModel = this.getOwnerComponent().getModel("user");
            var oUsersManagementModel = this.getOwnerComponent().getModel("users");

            apiClient.request("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username: sUsername, password: sPassword }),
                skipAuth: true
            })
            .then(function (oData) {
                var oPayload = (oData && oData.data) ? oData.data : oData;
                var oUserFromApi = (oPayload && oPayload.user) || (oData && oData.user) || { username: sUsername, name: sUsername };
                var sToken = (oPayload && oPayload.accessToken) || (oData && oData.token) || "";

                if (!sToken) {
                    throw new Error(this._getText("loginFailed"));
                }

                var oCurrentUser = this._enrichCurrentUser({
                    username: oUserFromApi.username,
                    name: oUserFromApi.name || oUserFromApi.username,
                    role: oUserFromApi.role || "",
                    status: oUserFromApi.status || "ACTIVE",
                    token: sToken,
                    tokenExpiry: Date.now() + 30 * 60 * 1000
                }, oUsersManagementModel);

                if (!oUserModel) {
                    oUserModel = new JSONModel({ users: [], currentUser: oCurrentUser });
                    this.getOwnerComponent().setModel(oUserModel, "user");
                } else {
                    oUserModel.setProperty("/currentUser", oCurrentUser);
                }

                localStorage.setItem("currentUser", JSON.stringify(oCurrentUser));
                oView.getModel().setProperty("/password", "");
                this._navToHome();
            }.bind(this))
            .catch(function (oError) {
                MessageToast.show(apiClient.getErrorMessage(oError, this._getText("loginFailed")));
                oView.getModel().setProperty("/password", "");
            }.bind(this));
        },

        _navToHome: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteHome", {}, true);
            setTimeout(function () {
                if (window.location.hash !== "#/home") {
                    window.location.hash = "#/home";
                }
            }, 100);
        },

        onRegister: function () {
            var sUsername = this.getView().getModel().getProperty("/username");
            var sPassword = this.getView().getModel().getProperty("/password");
            var oUserModel = this.getOwnerComponent().getModel("user");
            var aUsers = oUserModel.getProperty("/users");

            // Check if username already exists
            var existingUser = aUsers.find(function(user) {
                return user.username === sUsername;
            });

            if (existingUser) {
                MessageToast.show(this._getText("usernameExists"));
                return;
            }

            if (sUsername && sPassword) {
                aUsers.push({ username: sUsername, password: sPassword, name: sUsername });
                oUserModel.setProperty("/users", aUsers);
                var oRegisteredUser = {
                    username: sUsername,
                    password: sPassword,
                    name: sUsername,
                    token: "local-token-" + Math.random().toString(36).slice(2),
                    tokenExpiry: Date.now() + 30 * 60 * 1000
                };
                oUserModel.setProperty("/currentUser", oRegisteredUser);
                localStorage.setItem("currentUser", JSON.stringify(oRegisteredUser));
                this.getView().getModel().setProperty("/password", "");
                this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true);
                MessageToast.show(this._getText("registerSuccess"));
            } else {
                MessageToast.show(this._getText("loginRequired"));
            }
        },

        _getText: function (sKey) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey);
        },

        _enrichCurrentUser: function (oCurrentUser, oUsersManagementModel) {
            var aRegisteredUsers = oUsersManagementModel ? (oUsersManagementModel.getProperty("/registeredUsers") || []) : [];
            var oRegisteredUser = aRegisteredUsers.find(function (oItem) {
                return oItem.username === oCurrentUser.username;
            });

            if (!oRegisteredUser) {
                return oCurrentUser;
            }

            return Object.assign({}, oCurrentUser, {
                roleId: oRegisteredUser.roleId || "",
                roleName: oRegisteredUser.roleName || oRegisteredUser.role || "",
                department: oRegisteredUser.department || ""
            });
        }
    });
});