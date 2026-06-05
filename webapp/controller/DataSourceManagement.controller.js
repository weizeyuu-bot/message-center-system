sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/StepInput",
    "sap/ui/layout/form/SimpleForm",
    "sap/ui/model/json/JSONModel",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/ColumnListItem",
    "myapp/model/apiClient"
], function (Controller, MessageToast, MessageBox, Dialog, Button, Label, Input, TextArea,
             Select, Item, StepInput, SimpleForm, JSONModel, MTable, MColumn, MText, ColumnListItem, apiClient) {
    "use strict";

    var _h = { "Content-Type": "application/json" };
    var api = {
        get:   function (u)    { return apiClient.request(u); },
        post:  function (u, b) { return apiClient.request(u, { method: "POST",   headers: _h, body: JSON.stringify(b) }); },
        patch: function (u, b) { return apiClient.request(u, { method: "PATCH",  headers: _h, body: JSON.stringify(b) }); },
        del:   function (u)    { return apiClient.request(u, { method: "DELETE" }); }
    };

    return Controller.extend("myapp.controller.DataSourceManagement", {

        _t: function (sKey, aArgs) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        formatDsStatusText: function (sStatus) {
            return sStatus === "ACTIVE" ? this._t("dsStatusActive") : this._t("dsStatusInactive");
        },

        formatDsStatusState: function (sStatus) {
            return sStatus === "ACTIVE" ? "Success" : "Error";
        },

        onInit: function () {
            this.getView().setModel(new JSONModel({ list: [], queries: [] }), "ds");
            this._loadDataSources();
            this._loadQueryTemplates();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteHome");
        },

        onTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            if (sKey === "queries") this._loadQueryTemplates();
        },

        // ─── DataSource ──────────────────────────────────────

        _loadDataSources: function () {
            var that = this;
            api.get("/api/datasource").then(function (data) {
                that.getView().getModel("ds").setProperty("/list", Array.isArray(data) ? data : []);
            }).catch(function (e) { MessageToast.show(e.message); });
        },

        onAddDataSource: function () { this._openDsDialog(null); },
        onEditDataSource: function (oEvent) { this._openDsDialog(oEvent.getSource().data("context")); },

        _openDsDialog: function (oDs) {
            var that = this;
            var bEdit = !!oDs;
            var oData = oDs ? Object.assign({}, oDs) : { type: "POSTGRESQL", port: 5434 };
            var oModel = new JSONModel(oData);

            var oTypeSelect = new Select("_dsTypeSelect", {
                items: ["POSTGRESQL", "MYSQL", "MSSQL"].map(function (t) { return new Item({ key: t, text: t }); }),
                selectedKey: "{/_type > type}"
            }).bindElement({ path: "/" });
            oTypeSelect.setSelectedKey(oData.type);

            var oForm = new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", content: [
                new Label({ text: this._t("dsFieldName"), required: true }), new Input({ value: "{/name}" }),
                new Label({ text: this._t("dsFieldType"), required: true }), oTypeSelect,
                new Label({ text: this._t("dsFieldHost"), required: true }), new Input({ value: "{/host}" }),
                new Label({ text: this._t("dsFieldPort"), required: true }), new StepInput({ value: "{/port}", min: 1, max: 65535 }),
                new Label({ text: this._t("dsFieldDatabase"), required: true }), new Input({ value: "{/database}" }),
                new Label({ text: this._t("dsFieldSchemaOptional") }), new Input({ value: "{/schema}" }),
                new Label({ text: this._t("dsFieldUsername"), required: true }), new Input({ value: "{/username}" }),
                new Label({ text: this._t("dsFieldPassword"), required: true }), new Input({ value: "{/password}", type: "Password" }),
                new Label({ text: this._t("dsFieldDescription") }), new Input({ value: "{/description}" })
            ]});
            oForm.setModel(oModel);

            var oDialog = new Dialog({
                title: bEdit ? this._t("dsDialogEditDataSource") : this._t("dsDialogNewDataSource"),
                contentWidth: "520px",
                content: [oForm],
                beginButton: new Button({ text: this._t("saveButton"), type: "Emphasized", press: function () {
                    var oBody = oModel.getData();
                    oBody.type = oTypeSelect.getSelectedKey();
                    oBody.port = parseInt(oBody.port, 10);
                    var oReq = bEdit ? api.patch("/api/datasource/" + oDs.id, oBody) : api.post("/api/datasource", oBody);
                    oReq.then(function () {
                        MessageToast.show(bEdit ? that._t("dsToastUpdated") : that._t("dsToastCreated"));
                        oDialog.close();
                        that._loadDataSources();
                    }).catch(function (e) { MessageBox.error(e.message); });
                }}),
                endButton: new Button({ text: this._t("cancelButton"), press: function () { oDialog.close(); } }),
                afterClose: function () { oDialog.destroy(); }
            });
            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        onDeleteDataSource: function (oEvent) {
            var that = this;
            var oDs = oEvent.getSource().data("context");
            MessageBox.confirm(this._t("dsConfirmDeleteDataSource", [oDs.name]), {
                onClose: function (sAction) {
                    if (sAction !== "OK") return;
                    api.del("/api/datasource/" + oDs.id)
                        .then(function () { MessageToast.show(that._t("dsToastDeleted")); that._loadDataSources(); })
                        .catch(function (e) { MessageBox.error(e.message); });
                }
            });
        },

        onTestConnection: function (oEvent) {
            var that = this;
            var oDs = oEvent.getSource().data("context");
            api.post("/api/datasource/" + oDs.id + "/test", {}).then(function (res) {
                MessageBox.show(res.message, { icon: res.success ? MessageBox.Icon.SUCCESS : MessageBox.Icon.ERROR, title: that._t("dsConnectionTestTitle") });
            }).catch(function (e) { MessageBox.error(e.message); });
        },

        // ─── QueryTemplate ───────────────────────────────────

        _loadQueryTemplates: function (dsId) {
            var that = this;
            var url = dsId ? "/api/datasource/query-templates/list?dataSourceId=" + dsId : "/api/datasource/query-templates/list";
            api.get(url).then(function (data) {
                that.getView().getModel("ds").setProperty("/queries", Array.isArray(data) ? data : []);
            }).catch(function (e) { MessageToast.show(e.message); });
        },

        onFilterByDs: function (oEvent) {
            var sKey = oEvent.getSource().getSelectedKey();
            this._loadQueryTemplates(sKey || undefined);
        },

        onAddQueryTemplate: function () { this._openQtDialog(null); },
        onEditQueryTemplate: function (oEvent) { this._openQtDialog(oEvent.getSource().data("context")); },

        _openQtDialog: function (oQt) {
            var that = this;
            var bEdit = !!oQt;
            var oData = oQt ? Object.assign({}, oQt) : {};
            var oModel = new JSONModel(oData);
            var aDs = this.getView().getModel("ds").getProperty("/list") || [];

            var oDsSelect = new Select({ items: aDs.map(function (d) { return new Item({ key: d.id, text: d.name }); }) });
            if (oData.dataSourceId) oDsSelect.setSelectedKey(oData.dataSourceId);

            var oForm = new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", content: [
                new Label({ text: this._t("dsFieldName"), required: true }), new Input({ value: "{/name}" }),
                new Label({ text: this._t("dsFieldDataSource"), required: true }), oDsSelect,
                new Label({ text: this._t("dsFieldSql"), required: true }),
                new TextArea({ value: "{/sql}", rows: 6, width: "100%", placeholder: this._t("dsSqlPlaceholder") }),
                new Label({ text: this._t("dsFieldMessageTemplate") }),
                new TextArea({
                    value: "{/messageTemplate}",
                    rows: 6,
                    width: "100%",
                    placeholder: this._t("dsMessageTemplatePlaceholder")
                }),
                new Label({ text: this._t("dsFieldDescription") }), new Input({ value: "{/description}" })
            ]});
            oForm.setModel(oModel);

            var oDialog = new Dialog({
                title: bEdit ? this._t("dsDialogEditQueryTemplate") : this._t("dsDialogNewQueryTemplate"),
                contentWidth: "580px",
                content: [oForm],
                beginButton: new Button({ text: this._t("saveButton"), type: "Emphasized", press: function () {
                    var oBody = oModel.getData();
                    oBody.dataSourceId = oDsSelect.getSelectedKey();
                    var oReq = bEdit ? api.patch("/api/datasource/query-templates/" + oQt.id, oBody) : api.post("/api/datasource/query-templates", oBody);
                    oReq.then(function () {
                        MessageToast.show(bEdit ? that._t("dsToastUpdated") : that._t("dsToastCreated"));
                        oDialog.close();
                        that._loadQueryTemplates();
                    }).catch(function (e) { MessageBox.error(e.message); });
                }}),
                endButton: new Button({ text: this._t("cancelButton"), press: function () { oDialog.close(); } }),
                afterClose: function () { oDialog.destroy(); }
            });
            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        onDeleteQueryTemplate: function (oEvent) {
            var that = this;
            var oQt = oEvent.getSource().data("context");
            MessageBox.confirm(this._t("dsConfirmDeleteQueryTemplate", [oQt.name]), {
                onClose: function (sAction) {
                    if (sAction !== "OK") return;
                    api.del("/api/datasource/query-templates/" + oQt.id)
                        .then(function () { MessageToast.show(that._t("dsToastDeleted")); that._loadQueryTemplates(); })
                        .catch(function (e) { MessageBox.error(e.message); });
                }
            });
        },

        onPreviewQuery: function (oEvent) {
            var that = this;
            var oQt = oEvent.getSource().data("context");
            var oResultModel = new JSONModel({ columns: [], rows: [], messagePreview: "", loading: true, error: "" });

            var oPreviewArea = new TextArea({
                value: "{preview>/messagePreview}",
                editable: false,
                rows: 8,
                width: "100%"
            });

            var oTable = new MTable({
                growing: true,
                growingThreshold: 50,
                columns: { path: "preview>/columns", template: new MColumn({ header: new MText({ text: "{preview>label}" }) }) },
                items: { path: "preview>/rows", template: new ColumnListItem({ cells: [] }) }
            });

            var oDialog = new Dialog({
                title: that._t("dsDialogQueryPreview", [oQt.name]),
                contentWidth: "90%",
                contentHeight: "75%",
                resizable: true,
                content: [
                    new Label({ text: that._t("dsLabelMessagePreview") }),
                    oPreviewArea,
                    new Label({ text: that._t("dsLabelQueryResultPreview"), class: "sapUiSmallMarginTop" }),
                    oTable
                ],
                endButton: new Button({ text: that._t("dsButtonClose"), press: function () { oDialog.close(); } }),
                afterClose: function () { oDialog.destroy(); }
            });
            oDialog.setModel(oResultModel, "preview");
            this.getView().addDependent(oDialog);
            oDialog.open();

            api.post("/api/datasource/query-templates/" + oQt.id + "/preview", {}).then(function (res) {
                oResultModel.setProperty("/loading", false);
                oResultModel.setProperty("/columns", res.columns || []);
                oResultModel.setProperty("/rows", res.rows || []);
                oResultModel.setProperty("/messagePreview", res.messagePreview || "");

                // rebuild table columns dynamically
                oTable.destroyColumns();
                (res.columns || []).forEach(function (col) {
                    oTable.addColumn(new MColumn({ header: new MText({ text: col.label }) }));
                });
                // rebuild row template
                var oTpl = new ColumnListItem();
                (res.columns || []).forEach(function (col) {
                    oTpl.addCell(new MText({ text: "{preview>" + col.field + "}" }));
                });
                oTable.bindItems({ path: "preview>/rows", template: oTpl });

            }).catch(function (e) {
                oResultModel.setProperty("/loading", false);
                MessageBox.error(e.message);
            });
        }
    });
});
