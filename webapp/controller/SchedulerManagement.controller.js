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
    "sap/ui/layout/form/SimpleForm",
    "sap/ui/model/json/JSONModel",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/ColumnListItem",
    "sap/m/ObjectStatus",
    "myapp/model/apiClient"
], function (Controller, MessageToast, MessageBox, Dialog, Button, Label, Input,
             TextArea, Select, Item, SimpleForm, JSONModel, MTable, MColumn, MText, ColumnListItem, ObjectStatus, apiClient) {
    "use strict";

    var _h = { "Content-Type": "application/json" };
    var api = {
        get:   function (u)    { return apiClient.request(u); },
        post:  function (u, b) { return apiClient.request(u, { method: "POST",   headers: _h, body: JSON.stringify(b) }); },
        patch: function (u, b) { return apiClient.request(u, { method: "PATCH",  headers: _h, body: JSON.stringify(b) }); },
        del:   function (u)    { return apiClient.request(u, { method: "DELETE" }); }
    };

    return Controller.extend("myapp.controller.SchedulerManagement", {

        _t: function (sKey, aArgs) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        formatTaskStatusText: function (sStatus) {
            return sStatus === "ACTIVE" ? this._t("schStatusRunning") : this._t("schStatusPaused");
        },

        formatTaskStatusState: function (sStatus) {
            return sStatus === "ACTIVE" ? "Success" : "Warning";
        },

        formatToggleText: function (sStatus) {
            return sStatus === "ACTIVE" ? this._t("schButtonPause") : this._t("schButtonEnable");
        },

        onInit: function () {
            this.getView().setModel(new JSONModel({ tasks: [] }), "sched");
            this._loadTasks();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteHome");
        },

        formatDateTime: function (v) {
            return v ? new Date(v).toLocaleString() : "--";
        },

        _loadTasks: function () {
            var that = this;
            api.get("/api/scheduler/tasks").then(function (data) {
                that.getView().getModel("sched").setProperty("/tasks", Array.isArray(data) ? data : []);
            }).catch(function (e) { MessageToast.show(e.message); });
        },

        onAddTask: function () { this._openTaskDialog(null); },
        onEditTask: function (oEvent) { this._openTaskDialog(oEvent.getSource().data("context")); },

        _openTaskDialog: function (oTask) {
            var that = this;
            var bEdit = !!oTask;
            var oData = oTask ? Object.assign({}, oTask) : { cronExpr: "0 8 * * 1-5" };
            var oModel = new JSONModel(oData);

            var oQtSelect = new Select({ width: "100%" });
            var oChSelect = new Select({ width: "100%" });

            // load query templates and channels
            Promise.all([
                api.get("/api/datasource/query-templates/list"),
                api.get("/api/notify/channels")
            ]).then(function (results) {
                (results[0] || []).forEach(function (q) { oQtSelect.addItem(new Item({ key: q.id, text: q.name })); });
                if (oData.queryTemplateId) oQtSelect.setSelectedKey(oData.queryTemplateId);
                (results[1] || []).forEach(function (c) { oChSelect.addItem(new Item({ key: c.id, text: c.name + " [" + c.type + "]" })); });
                if (oData.channelId) oChSelect.setSelectedKey(oData.channelId);
            });

            var oForm = new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", content: [
                new Label({ text: this._t("schFieldTaskName"), required: true }), new Input({ value: "{/name}" }),
                new Label({ text: this._t("schFieldCron"), required: true }),
                new Input({ value: "{/cronExpr}", placeholder: this._t("schCronPlaceholder") }),
                new Label({ text: this._t("schFieldQueryTemplate"), required: true }), oQtSelect,
                new Label({ text: this._t("schFieldChannel"), required: true }), oChSelect,
                new Label({ text: this._t("schFieldRecipients") }), new Input({ value: "{/recipients}", placeholder: this._t("schRecipientsPlaceholder") }),
                new Label({ text: this._t("schFieldMessageTitle") }), new Input({ value: "{/messageTitle}" })
            ]});
            oForm.setModel(oModel);

            var oDialog = new Dialog({
                title: bEdit ? this._t("schDialogEdit") : this._t("schDialogNew"),
                contentWidth: "560px",
                content: [oForm],
                beginButton: new Button({ text: this._t("saveButton"), type: "Emphasized", press: function () {
                    var oBody = oModel.getData();
                    oBody.queryTemplateId = oQtSelect.getSelectedKey();
                    oBody.channelId = oChSelect.getSelectedKey();
                    var oReq = bEdit ? api.patch("/api/scheduler/tasks/" + oTask.id, oBody) : api.post("/api/scheduler/tasks", oBody);
                    oReq.then(function () {
                        MessageToast.show(bEdit ? that._t("schToastUpdated") : that._t("schToastCreated"));
                        oDialog.close();
                        that._loadTasks();
                    }).catch(function (e) { MessageBox.error(e.message); });
                }}),
                endButton: new Button({ text: this._t("cancelButton"), press: function () { oDialog.close(); } }),
                afterClose: function () { oDialog.destroy(); }
            });
            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        onDeleteTask: function (oEvent) {
            var that = this;
            var oTask = oEvent.getSource().data("context");
            MessageBox.confirm(this._t("schDeleteConfirm", [oTask.name]), {
                onClose: function (sAction) {
                    if (sAction !== "OK") return;
                    api.del("/api/scheduler/tasks/" + oTask.id)
                        .then(function () { MessageToast.show(that._t("schToastDeleted")); that._loadTasks(); })
                        .catch(function (e) { MessageBox.error(e.message); });
                }
            });
        },

        onToggleTask: function (oEvent) {
            var that = this;
            var oTask = oEvent.getSource().data("context");
            api.post("/api/scheduler/tasks/" + oTask.id + "/toggle", {}).then(function () {
                MessageToast.show(that._t("schToastToggled"));
                that._loadTasks();
            }).catch(function (e) { MessageBox.error(e.message); });
        },

        onManualRun: function (oEvent) {
            var that = this;
            var oTask = oEvent.getSource().data("context");
            MessageToast.show(this._t("schToastRunning"));
            api.post("/api/scheduler/tasks/" + oTask.id + "/run", {}).then(function (log) {
                var sMsg = log.status === "SUCCESS"
                    ? that._t("schRunSuccess", [log.rowCount || 0])
                    : that._t("schRunFailed", [log.message || ""]);
                MessageBox.show(sMsg, { icon: log.status === "SUCCESS" ? MessageBox.Icon.SUCCESS : MessageBox.Icon.ERROR, title: that._t("schRunResultTitle") });
                that._loadTasks();
            }).catch(function (e) { MessageBox.error(e.message); });
        },

        onViewLogs: function (oEvent) {
            var that = this;
            var oTask = oEvent.getSource().data("context");
            var oModel = new JSONModel({ logs: [] });

            api.get("/api/scheduler/tasks/" + oTask.id + "/logs").then(function (data) {
                oModel.setProperty("/logs", Array.isArray(data) ? data : []);
            });

            var oTable = new MTable({
                growing: true,
                growingThreshold: 20,
                columns: [
                    new MColumn({ header: new MText({ text: that._t("schLogColumnStartedAt") }) }),
                    new MColumn({ header: new MText({ text: that._t("schLogColumnStatus") }) }),
                    new MColumn({ header: new MText({ text: that._t("schLogColumnRowCount") }) }),
                    new MColumn({ header: new MText({ text: that._t("schLogColumnMessage") }) }),
                    new MColumn({ header: new MText({ text: that._t("schLogColumnActions") }) })
                ],
                items: { path: "log>/logs", template: new ColumnListItem({ cells: [
                    new MText({ text: { path: "log>startedAt", formatter: function (v) { return v ? new Date(v).toLocaleString() : ""; } } }),
                    new ObjectStatus({ text: "{log>status}", state: { path: "log>status", formatter: function (v) { return v === "SUCCESS" ? "Success" : "Error"; } } }),
                    new MText({ text: "{log>rowCount}" }),
                    new MText({ text: "{log>message}" }),
                    new Button({
                        text: that._t("schButtonViewContent"),
                        type: "Ghost",
                        enabled: "{= !!${log>content} }",
                        press: function (oPressEvent) {
                            var oLog = oPressEvent.getSource().getBindingContext("log").getObject();
                            that._openLogContentDialog(oLog);
                        }
                    })
                ] }) }
            });
            oTable.setModel(oModel, "log");

            var oDialog = new Dialog({
                title: this._t("schLogDialogTitle", [oTask.name]),
                contentWidth: "700px",
                contentHeight: "50%",
                resizable: true,
                content: [oTable],
                endButton: new Button({ text: this._t("schButtonClose"), press: function () { oDialog.close(); } }),
                afterClose: function () { oDialog.destroy(); }
            });
            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        _openLogContentDialog: function (oLog) {
            var that = this;
            var oDialog = new Dialog({
                title: this._t("schContentDialogTitle"),
                contentWidth: "900px",
                contentHeight: "60%",
                resizable: true,
                content: [
                    new Text({ text: this._t("schStartedAtPrefix", [oLog.startedAt ? new Date(oLog.startedAt).toLocaleString() : "-"]) }),
                    new TextArea({ value: oLog.content || "", editable: false, rows: 22, width: "100%" })
                ],
                endButton: new Button({ text: that._t("schButtonClose"), press: function () { oDialog.close(); } }),
                afterClose: function () { oDialog.destroy(); }
            });
            this.getView().addDependent(oDialog);
            oDialog.open();
        }
    });
});
