sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("myapp.controller.Profile", {

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteHome");
        },

        onSave: function () {
            // In a real app, save to backend
            MessageToast.show(this._getText("profileSaved"));
            this.onNavBack();
        },

        _getText: function (sKey) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey);
        }
    });
});