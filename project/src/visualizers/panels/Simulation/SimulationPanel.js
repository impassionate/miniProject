define([
  "js/PanelBase/PanelBaseWithHeader",
  "js/PanelManager/IActivePanel",
  "widgets/Simulation/SimulationWidget",
  "./SimulationControl",
], function (PanelBaseWithHeader, IActivePanel, SimulationWidget, SimulationControl) {
  "use strict";

  function SimulationPanel(layoutManager, params) {
    var options = {};
    //set properties from options
    options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = "SimulationPanel";
    options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;

    //call parent's constructor
    PanelBaseWithHeader.apply(this, [options, layoutManager]);

    this._client = params.client;

    //initialize UI
    this._initialize();

    this.logger.debug("ctor finished");
  }

  //inherit from PanelBaseWithHeader
  _.extend(SimulationPanel.prototype, PanelBaseWithHeader.prototype);
  _.extend(SimulationPanel.prototype, IActivePanel.prototype);

  SimulationPanel.prototype._initialize = function () {
    var self = this;
    this.setTitle("");

    this.widget = new SimulationWidget(this.logger, this.$el);

    this.widget.setTitle = function (title) {
      self.setTitle(title);
    };

    this.control = new SimulationControl({
      logger: this.logger,
      client: this._client,
      widget: this.widget,
    });

    this.onActivate();
  };

  /* OVERRIDE FROM WIDGET-WITH-HEADER */
  /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
  SimulationPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
    //apply parent's onReadOnlyChanged
    PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);
  };

  SimulationPanel.prototype.onResize = function (width, height) {
    this.logger.debug("onResize --> width: " + width + ", height: " + height);
    this.widget.onWidgetContainerResize(width, height);
  };

  /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
  SimulationPanel.prototype.destroy = function () {
    this.control.destroy();
    this.widget.destroy();

    PanelBaseWithHeader.prototype.destroy.call(this);
    WebGMEGlobal.KeyboardManager.setListener(undefined);
    WebGMEGlobal.Toolbar.refresh();
  };

  SimulationPanel.prototype.onActivate = function () {
    this.widget.onActivate();
    this.control.onActivate();
    WebGMEGlobal.KeyboardManager.setListener(this.widget);
    WebGMEGlobal.Toolbar.refresh();
  };

  SimulationPanel.prototype.onDeactivate = function () {
    this.widget.onDeactivate();
    this.control.onDeactivate();
    WebGMEGlobal.KeyboardManager.setListener(undefined);
    WebGMEGlobal.Toolbar.refresh();
  };

  return SimulationPanel;
});
