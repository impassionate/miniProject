define(["jointjs", "css!./styles/SimulationWidget.css"], function (joint) {
  "use strict";
  var WIDGET_CLASS = "sim-viz";
  function SimulationWidget(logger, container) {
    this._logger = logger.fork("Widget");
    this._el = container;
    this.nodes = {};
    this._initialize();
  }

  SimulationWidget.prototype.initMachine = function (myPetriParam) {
    const self = this;
    self.myNet = myPetriParam;
    self._jointPetriNet.clear();
    self.initPlace();
    self.initTrans();
    ["ArcP_T", "ArcT_P"].forEach((arcType) => {
      self.initArc(arcType);
    });
    self._jointPaper.updateViews();
    self._decorateMachine();
  };
  
  SimulationWidget.prototype._initialize = function () {
    var width = this._el.width(),
      height = this._el.height(),
      self = this;
	  
    self._el.addClass(WIDGET_CLASS);
    const namespace = joint.shapes;
    self._jointPetriNet = new joint.dia.Graph({}, { cellNamespace: namespace });
    self._jointPaper = new joint.dia.Paper({
      el: self._el,
      width: width,
      height: height,
      gridSize: 10,
      model: self._jointPetriNet,
      defaultAnchor: { name: "perpendicular" },
      defaultConnectionPoint: { name: "boundary" },
      cellViewNamespace: namespace,
    });
    self._el.on("dblclick", function (event) {
      event.stopPropagation();
      event.preventDefault();
      self.onBackgroundDblClick();
    });
	
    joint.shapes.myPlace = joint.shapes.basic.Generic.define(
      "myPlace",
      {
        attrs: {
          ".root": {
            r: 25,
            fill: "#ffffff",
            stroke: "Black",
            transform: "translate(25, 25)",
          },
          ".label": {
            "text-anchor": "middle",
            "ref-x": 0.5,
            "ref-y": -20,
            fill: "#000000",
            "font-size": 16,
          },
          ".tokens > circle": {
			transform: "translate(25, 25)",
          },
        },
      },
      {
        markup:
          '<g class="rotatable"><g class="scalable"><circle class="root"/><g class="tokens" /></g><text class="label"/></g>',
      }
    );

    joint.shapes.myPlaceView = joint.dia.ElementView.extend({
      presentationAttributes: joint.dia.ElementView.addPresentationAttributes({
        tokens: ["TOKENS"],
      }),
      initFlag: joint.dia.ElementView.prototype.initFlag.concat(["TOKENS"]),

      confirmUpdate: function (sign) {
        let flags = joint.dia.ElementView.prototype.confirmUpdate.call(this,sign);
        if (this.hasFlag(flags, "TOKENS")) {
		  const vTokens = this.vel.findOne(".tokens").empty();
          if (this.model.get("tokens") == 0) {
			  return;
		  }
		  vTokens.append(joint.V("circle"));
          this.update();
          flags = this.removeFlag(flags, "TOKENS");
        }
        return flags;
      },
    });

    joint.shapes.pn.TransitionView = joint.dia.ElementView.extend({
      presentationAttributes: joint.dia.ElementView.addPresentationAttributes({
        enabled: ["ON"],
      }),
      initFlag: joint.dia.ElementView.prototype.initFlag.concat(["ON"]),

      confirmUpdate: function (sign) {
        let flags = joint.dia.ElementView.prototype.confirmUpdate.call(this,sign);
        if (this.hasFlag(flags, "ON")) {
			let root = this.vel.findOne(".root");
			let label = this.vel.findOne(".label");
			let transitionName = this.model.get("name");
			if (this.model.get("enabled")) {
			  label.addClass("enabled").removeClass("disabled");
			  root.addClass("ACTIVATED");
			} else {
			  label.removeClass("enabled").addClass("disabled");
			  root.removeClass("ACTIVATED");
			}
            this.update();
            flags = this.removeFlag(flags, "ON");
        }
        return flags;
      },
    });

  };

	  
  SimulationWidget.prototype.onWidgetContainerResize = function (width, height) {
    this._logger.debug("Widget is resizing...");
  };

  SimulationWidget.prototype.initPlace = function () {
    let self = this;
    self.myNet.placeId = {};
    Object.keys(self.myNet.places).forEach((placeId) => {
      let place = self.myNet.places[placeId];
      let symbol = new joint.shapes.myPlace({
        position: place.position,
        size: { width: 40, height: 40 },
        attrs: {
          ".label": {
            text: self.myNet.places[placeId].name,
            fill: "Black",
          },
          ".root": {
            stroke: "#d9d919",
            strokeWidth: 3,
          },
          ".tokens > circle": {
            fill: "Black",
			r: 3,
          },
        },
        tokens: place.Marking,
      });
      self._jointPetriNet.addCell([symbol]);
      self.myNet.places[placeId].joint = symbol;
      self.myNet.placeId[symbol.id] = placeId;
    });
  };

  SimulationWidget.prototype.initTrans = function () {
    let self = this;
    self.myNet.transId = {};
    Object.keys(self.myNet.transitions).forEach((transitionId) => {
      let transition = self.myNet.transitions[transitionId];
      let symbol = new joint.shapes.pn.Transition({
        position: transition.position,
        size: { width: 40, height: 40 },
        attrs: {
          ".label": {
            text: transition.name,
            "text-anchor": "middle",
            "ref-x": 0.5,
            "ref-y": -20,
            ref: ".root",
            fontSize: 18,
          },
          ".root": {
            fill: "#3299cc",
            stroke: "#3299cc",
          },
          ".root.ACTIVATED": {
            stroke: "green",
            fill: "green",
          },
        },
      });
      symbol.addTo(self._jointPetriNet);
      self.myNet.transitions[transitionId].joint = symbol;
      self.myNet.transId[symbol.id] = transitionId;
    });
  };
  SimulationWidget.prototype.updateTrans = function () {
    let self = this;
    let activedTrans = [];
    Object.keys(self.myNet.transitions).forEach((tid) => {
      let transition = self.myNet.transitions[tid];
      let fireable = self.validTrans(self, transition.joint);
      transition.joint.set("enabled", fireable);
      if (fireable) {
        activedTrans.push(transition);
      }
    });
    self.myNet.activatedEv(activedTrans);
  };

  SimulationWidget.prototype.initArc = function (arcType) {
    let self = this;
    let createJointLink = (fstLink, scdLink, name) => {
      return new joint.shapes.standard.Link({
        source: { id: fstLink.id },
        target: { id: scdLink.id },
        attrs: {
          line: {
            strokeWidth: 2,
          },
          wrapper: {
            cursor: "default",
          },
        },
        labels: [
          {
            position: {
              distance: 0.5,
              offset: 0,
            },
          },
        ],
      });
    };
    let myArcList;
    if (arcType === "ArcP_T") {
        myArcList = self.myNet.arcPtoT;
	}else{
        myArcList = self.myNet.arcTtoP;
	}
    myArcList.forEach((arc) => {
      let src;
	  let dst;
      if (arcType === "ArcP_T"){
          src = self.myNet.places[arc.src];
		  dst = self.myNet.transitions[arc.dst];
	  }else{
          src = self.myNet.transitions[arc.src];
		  dst = self.myNet.places[arc.dst];
	  }
      src.jointOutArcs = src.jointOutArcs || {};
      createJointLink(src.joint, dst.joint, arc.name).addTo(self._jointPetriNet);
      src.jointOutArcs[arc.id] = createJointLink(src.joint, dst.joint, arc.name);
    });
  };
  
  SimulationWidget.prototype.validTrans = function (self, t, prevP) {
	var isValidP;
    if (prevP == null) {
      var prevP = self._jointPetriNet.getConnectedLinks(t, {
        inbound: true,
      }).map(function (link) {
        return link.getSourceElement();
      });
    }
    prevP.forEach(function (p) {
      if (p.get("tokens") === 0) {
        isValidP = false;
      }else{
		isValidP = true; 
	  }
    });
    return isValidP;
  };

  SimulationWidget.prototype.startTrans = function (t, sec, self) {
      if (self.validTrans(self, t, 
	  self._jointPetriNet.getConnectedLinks(t, { inbound: true }).map(function (link) {
        return link.getSourceElement();
      }))) {
        let TOKEN_COLOR = "#0000ff";
        let TOKEN_RADIUS = 2;
        self._jointPetriNet.getConnectedLinks(t, { inbound: true }).map(function (link) {
        return link.getSourceElement();
      }).forEach(function (p) {
          setTimeout(function () {
            p.set("tokens", p.get("tokens") - 1);
          }, 0);
        });

        self._jointPetriNet.getConnectedLinks(t, {outbound: true}).map(function (link) {
        return link.getTargetElement();
      }).forEach(function (p) {
          var links = self._jointPetriNet.getConnectedLinks(t, {outbound: true}).filter(function (l) {
            return l.getTargetElement() === p;
          });
		  p.set("tokens", p.get("tokens") + 1);
        });
      }
    };

  SimulationWidget.prototype.makeItHappen = function (transition) {
    let self = this;
    if (transition == null) {
	  (self) => {
		Object.keys(self.myNet.transitions).forEach((tid) => {
			self.startTrans(self.myNet.transitions[tid].joint, 1, self);
      });
    }
    } else {
      self.startTrans(transition.joint, 1, self);
    }
    setTimeout(() => {
      self._decorateMachine();
    }, 100);
  };

  SimulationWidget.prototype.destroyMachine = function () {};

  SimulationWidget.prototype.resetMachine = function () {
    this.initMachine(this.myNet);
  };

  SimulationWidget.prototype._decorateMachine = function () {
    let self = this;
    self.updateTrans();
  };
  /* * * * * * * * Visualizer event handlers * * * * * * * */

  SimulationWidget.prototype.onNodeClick = function (/*id*/) {
    // This currently changes the active node to the given id and
    // this is overridden in the controller.
  };

  SimulationWidget.prototype.onBackgroundDblClick = function () {
    this._el.append("<div>Background was double-clicked!!</div>");
  };

  /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
  SimulationWidget.prototype.destroy = function () {};

  SimulationWidget.prototype.onActivate = function () {
    this._logger.debug("SimulationWidget has been activated");
  };

  SimulationWidget.prototype.onDeactivate = function () {
    this._logger.debug("SimulationWidget has been deactivated");
  };

  return SimulationWidget;
});
