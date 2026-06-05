sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "myapp/model/apiClient"
], function (Controller, MessageToast, JSONModel, apiClient) {
    "use strict";

    var _h = { "Content-Type": "application/json" };
    var api = {
        get: function (u) { return apiClient.request(u); },
        post: function (u, b) { return apiClient.request(u, { method: "POST", headers: _h, body: JSON.stringify(b) }); }
    };

    return Controller.extend("myapp.controller.SystemManagement", {

        onInit: function () {
            var oSystemModel = this.getOwnerComponent().getModel("system");
            this.getView().setModel(oSystemModel, "system");
            this._loadOverview();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteHome");
        },

        onLogLevelChange: function (oEvent) {
            var oComboBox = oEvent.getSource();
            var oSelectedItem = oComboBox.getSelectedItem();
            if (oSelectedItem) {
                var sLevel = oSelectedItem.getText();
                MessageToast.show(this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("systemLogLevelFilter", [sLevel]));

                var sKey = oSelectedItem.getKey();
                var aAllLogs = this.getView().getModel("system").getProperty("/allSystemLogs") || [];
                var aFiltered = sKey && sKey !== "all"
                    ? aAllLogs.filter(function (oLog) { return String(oLog.level || "").toLowerCase() === sKey.toLowerCase(); })
                    : aAllLogs;
                this.getView().getModel("system").setProperty("/systemLogs", aFiltered);
            }
        },

        formatLoginStatusText: function (sStatus) {
            var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            var mKey = {
                LOGGED_IN: "loginStatusLoggedIn",
                LOGGED_OUT: "loginStatusLoggedOut"
            };
            return oBundle.getText(mKey[sStatus] || "loginStatus");
        },

        _loadOverview: function () {
            var that = this;
            api.get("/api/system/overview").then(function (data) {
                var oModel = that.getView().getModel("system");
                var oData = data || {};

                var aLoginHistory = Array.isArray(oData.loginHistory) ? oData.loginHistory : [];
                var aOnlineUsers = Array.isArray(oData.onlineUsersList) ? oData.onlineUsersList : [];
                var aLogs = Array.isArray(oData.systemLogs) ? oData.systemLogs : [];

                aLoginHistory = aLoginHistory.map(function (oItem) {
                    return Object.assign({}, oItem, {
                        loginTime: that._formatDate(oItem.loginTime)
                    });
                });

                aOnlineUsers = aOnlineUsers.map(function (oItem) {
                    return Object.assign({}, oItem, {
                        loginTime: that._formatDate(oItem.loginTime),
                        lastActivity: that._formatDate(oItem.lastActivity)
                    });
                });

                aLogs = aLogs.map(function (oItem) {
                    return Object.assign({}, oItem, {
                        timestamp: that._formatDate(oItem.timestamp)
                    });
                });

                oModel.setProperty("/onlineUsers", Number(oData.onlineUsers || 0));
                oModel.setProperty("/systemUptime", oData.systemUptime || "-");
                oModel.setProperty("/cpuUsage", oData.cpuUsage || "0%");
                oModel.setProperty("/cpuUsageValue", Number(oData.cpuUsageValue || 0));
                oModel.setProperty("/memoryUsage", oData.memoryUsage || "0%");
                oModel.setProperty("/memoryUsageValue", Number(oData.memoryUsageValue || 0));
                oModel.setProperty("/loginHistory", aLoginHistory);
                oModel.setProperty("/onlineUsersList", aOnlineUsers);
                oModel.setProperty("/allSystemLogs", aLogs);
                oModel.setProperty("/systemLogs", aLogs);
            }).catch(function (e) {
                MessageToast.show(apiClient.getErrorMessage(e, that._t("loadFailed")));
            });
        },

        _formatDate: function (value) {
            if (!value) {
                return "-";
            }
            var date = new Date(value);
            if (isNaN(date.getTime())) {
                return String(value);
            }
            return date.toLocaleString();
        },

        _t: function (sKey, aArgs) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        }
    });
});
