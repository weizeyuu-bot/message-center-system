sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("myapp.controller.App", {
        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.attachBeforeRouteMatched(this._onBeforeRouteMatched, this);
        },

        _onBeforeRouteMatched: function (oEvent) {
            if (this._isRerouter) {
                return;
            }

            var oUserModel = this.getOwnerComponent().getModel("user");
            var oCurrentUser = oUserModel && oUserModel.getProperty("/currentUser");
            var sRouteName = oEvent.getParameter("name");

            if (!oCurrentUser || !oCurrentUser.username) {
                if (sRouteName !== "RouteLogin") {
                    oEvent.preventDefault();
                    var oApp = this.byId("app");
                    if (oApp) { oApp.removeAllPages(); }
                    this.getOwnerComponent().getRouter().navTo("RouteLogin", {}, true);
                }
                return;
            }

            if (sRouteName === "RouteApp" || sRouteName === "RouteLogin") {
                oEvent.preventDefault();
                var oApp = this.byId("app");
                if (oApp) { oApp.removeAllPages(); }
                this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true);
            }
        }
    });
});