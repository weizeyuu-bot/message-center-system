sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], function (JSONModel, Device) {
    "use strict";

    return {

        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },

        createUserModel: function () {
            var oSavedUser = null;
            try {
                oSavedUser = JSON.parse(localStorage.getItem("currentUser"));
            } catch (e) {
                oSavedUser = null;
            }

            return new JSONModel({ users: [], currentUser: oSavedUser || null });
        },

        createStatusOptionsModel: function () {
            var aUserStatus = [
                { key: "ACTIVE",   textKey: "statusActive" },
                { key: "INACTIVE", textKey: "statusInactive" },
                { key: "DISABLED", textKey: "statusDisabled" }
            ];
            return new JSONModel({
                userStatus:               aUserStatus,
                userStatusWithBlank:      [{ key: "", textKey: "pleaseSelect" }].concat(aUserStatus)
            });
        },

        resolveStatusOptionsText: function (oStatusModel, oResourceBundle) {
            if (!oStatusModel || !oResourceBundle) {
                return;
            }
            var oData = oStatusModel.getData();
            Object.keys(oData).forEach(function (sGroup) {
                var aItems = oData[sGroup];
                if (Array.isArray(aItems)) {
                    aItems.forEach(function (oItem) {
                        oItem.text = oResourceBundle.getText(oItem.textKey);
                    });
                }
            });
            oStatusModel.refresh(true);
        },

        createUserManagementModel: function () {
            var oData = {
                roles: [],
                permissionCatalog: [
                    { module: "users", moduleName: "用户管理", groupKey: "permissionGroupGovernanceConfig" },
                    { module: "roles", moduleName: "角色管理", groupKey: "permissionGroupGovernanceConfig" },
                    { module: "permissionManagement", moduleName: "权限管理", groupKey: "permissionGroupGovernanceConfig" },
                    { module: "system", moduleName: "系统管理", groupKey: "permissionGroupGovernanceConfig" },
                    { module: "dataSourceManagement", moduleName: "数据源管理", groupKey: "permissionGroupMessageCenter" },
                    { module: "schedulerManagement", moduleName: "定时任务", groupKey: "permissionGroupMessageCenter" },
                    { module: "notifyChannelManagement", moduleName: "通知通道", groupKey: "permissionGroupMessageCenter" }
                ],
                registeredUsers: [],
                statistics: {
                    totalUsers: 0,
                    activeUsers: 0,
                    inactiveUsers: 0,
                    thisMonthNewUsers: 0
                }
            };
            return new JSONModel(oData);
        },

        createSystemManagementModel: function () {
            var oData = {
                onlineUsers: 0,
                systemUptime: "0天 0小时 0分钟",
                cpuUsage: "0%",
                cpuUsageValue: 0,
                memoryUsage: "0%",
                memoryUsageValue: 0,
                loginHistory: [],
                onlineUsersList: [],
                logLevels: [
                    { id: "all", name: "全部" },
                    { id: "error", name: "错误" },
                    { id: "warning", name: "警告" },
                    { id: "info", name: "信息" },
                    { id: "debug", name: "调试" }
                ],
                systemLogs: []
            };
            return new JSONModel(oData);
        }

    };
});

