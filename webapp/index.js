sap.ui.getCore().attachInit(function () {
    sap.ui.require([
        "sap/ui/core/ComponentContainer"
    ], function (ComponentContainer) {
        new ComponentContainer({
            name: "myapp",
            settings: {
                id: "myapp"
            }
        }).placeAt("content");
    });
});