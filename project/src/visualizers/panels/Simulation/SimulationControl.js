define([
  "js/Constants",
  "js/Utils/GMEConcepts",
  "js/NodePropertyNames",
], function (CONSTANTS, GMEConcepts, nodePropertyNames) {
  "use strict";
  function SimulationControl(options) {
    this._logger = options.logger.fork("Control");
    this._client = options.client;
    // Initialize core collections and variables
    this._widget = options.widget;
    this._widget._client = options.client;
    this._currentNodeId = null;
    this._fireableEvents = null;
    this._networkRootLoaded = false;
    this._initWidgetEventHandlers();
    this.activatedEv = this.activatedEv.bind(this);
  }

  SimulationControl.prototype._initWidgetEventHandlers = function () {
    this._widget.onNodeClick = function (id) {
      WebGMEGlobal.State.registerActiveObject(id);
    };
  };

  /* * * * * * * * Visualizer content update callbacks * * * * * * * */
  SimulationControl.prototype.selectedObjectChanged = function (nodeId) {
    var self = this;
    // Remove current territory patterns
    if (self._currentNodeId) {
      self._client.removeUI(self._territoryId);
      self._networkRootLoaded = false; //addme
    }

    self._currentNodeId = nodeId;

    if (typeof self._currentNodeId === "string") {
      // Put new node's info into territory rules
      self._selfPatterns = {};
      self._selfPatterns[nodeId] = { children: 1 }; // Territory "rule"

      self._territoryId = self._client.addUI(self, function (events) {
        self._eventCallback(events);
      });

      // Update the territory
      self._client.updateTerritory(self._territoryId, self._selfPatterns);
    }
  };

  /* * * * * * * * Node Event Handling * * * * * * * */
  SimulationControl.prototype._eventCallback = function (events) {
    const self = this;
    events.forEach((event) => {
      if (event.eid && event.eid === self._currentNodeId) {
        if (event.etype == "load" || event.etype == "update") {
          self._networkRootLoaded = true;
        } else {
          self.destroyAll();
          return;
        }
      }
    });

    if (
      events.length &&
      events[0].etype === "complete" &&
      self._networkRootLoaded
    ) {
      self._initPetriNet();
    }
  };


  /* * * * * * * * Machine manipulation functions * * * * * * * */
  
  SimulationControl.prototype.findP_T = function (transId, outputMatrix){
	return Object.keys(outputMatrix).filter(
		(placeId) => outputMatrix[placeId][transId]
	);
  };
  
  SimulationControl.prototype.startId = function (inputMatrix) {
	  for (const placeId in inputMatrix) {
		if (Object.entries(inputMatrix[placeId]).every((arr) => {return !arr[1];})) {
		  return placeId;
		}
	  }
	  for (const placeId in inputMatrix) {
		return placeId;
	  }
	};
  
  SimulationControl.prototype.findArc = function (client, metaName, elementIds) {
	let arcs = [];
	elementIds.forEach((id, i) => {
		let node = client.getNode(id);
		if (client.getNode(node.getMetaTypeId()).getAttribute("name") === metaName) {
			arcs.push({
			id: id,
			name: node.getAttribute("name"),
			src: node.getPointerId("src"),
			dst: node.getPointerId("dst"),
		});
		}
	  });
	  return arcs;
	};

  SimulationControl.prototype.getNextP = function (placeId,arcPtoT,arcTtoP) {
	  let nextPlaces = [];
	  let outFlowArcs = arcPtoT.filter((arc) => arc.src === placeId);
	  outFlowArcs.forEach((arc_p2t) => {
		nextPlaces.push(
		  ...arcTtoP
			.filter((arc_t2p) => arc_t2p.src === arc_p2t.dst)
			.map((arc_t2p) => {
			  if (arc_t2p.src === arc_p2t.dst) {
				return arc_t2p.dst;
			  }
			})
		);
	  });
	  return nextPlaces;
	};

	SimulationControl.prototype.getIn = function (placeIds, transitionIds, arcTtoP) {
	  let inputMatrix = {};
	  placeIds.forEach((pid, i) => {
		inputMatrix[pid] = {};
		transitionIds.forEach((tid, j) => {
		  inputMatrix[pid][tid] = this.inflow(
			pid,
			tid,
			arcTtoP
		  );
		});
	  });
	  return inputMatrix;
	};

	SimulationControl.prototype.getOut = function (placeIds, transitionIds, arcPtoT) {
	  let outputMatrix = {};
	  placeIds.forEach((pid, i) => {
		outputMatrix[pid] = {};
		transitionIds.forEach((tid, j) => {
		  outputMatrix[pid][tid] = this.outflow(
			pid,
			tid,
			arcPtoT
		  );
		});
	  });
	  return outputMatrix;
	};

	SimulationControl.prototype.outflow = function (placeId,transitionId,arcPtoT) {
	  return arcPtoT.some((arc, index) => {
		return arc.src === placeId && arc.dst === transitionId;
	  });
	};

	SimulationControl.prototype.inflow = function (placeId,transitionId,arcTtoP) {
	  return arcTtoP.some((arc, index) => {
		return arc.src === transitionId && arc.dst === placeId;
	  });
	};

	SimulationControl.prototype.inDeadLock = function (petriNet) {
	  return Object.keys(petriNet.transitions).every((transId) => {
		findP_T(transId, petriNet.outputMatrix).every(
		  (inPlaceId) => {
			parseInt(petriNet.places[inPlaceId].Marking) <= 0;
		  }
		);
	  });
	};
  
  SimulationControl.prototype._initPetriNet = function () {
    const rawMETA = this._client.getAllMetaNodes();
    const META = {};
    const self = this;
    rawMETA.forEach((node) => {
      META[node.getAttribute("name")] = node.getId(); 
    });
    const petriNetNode = this._client.getNode(this._currentNodeId);
    const elementIds = petriNetNode.getChildrenIds();
	let placeIds = [];
	elementIds.forEach((id, i) => {
		let node = this._client.getNode(id);
		if (this._client.getNode(node.getMetaTypeId()).getAttribute("name") === "Place") {
			placeIds.push(id);
		}
	});
	let transitionIds = [];
    elementIds.forEach((id, i) => {
		let node = this._client.getNode(id);
		if (this._client.getNode(node.getMetaTypeId()).getAttribute("name") === "Transition") {
			transitionIds.push(id);
		}
	});
    let arcTtoP = this.findArc(self._client,"ArcT_P",elementIds);
    let arcPtoT = this.findArc(self._client,"ArcP_T",elementIds);
    let inputMatrix = this.getIn(placeIds,transitionIds,arcTtoP);
    let startingPlaceId = this.startId(inputMatrix);
    let outputMatrix = this.getOut(placeIds,transitionIds,arcPtoT);
    let petriNet = {deadlockActive: this.inDeadLock,startingPlace: startingPlaceId,places: {},transitions: {},inputMatrix: inputMatrix,outputMatrix: outputMatrix,arcPtoT: arcPtoT,arcTtoP: arcTtoP,};
    elementIds.forEach((elementId) => {
      const node = self._client.getNode(elementId);
      if (node.isTypeOf(META["Place"])) {
        petriNet.places[elementId] = {
          id: elementId,
          name: node.getAttribute("name"),
          Marking: parseInt(node.getAttribute("Marking")),
          nextPlaceIds: this.getNextP(
            elementId,
            arcPtoT,
            arcTtoP
          ),
          outTransitions: Object.keys(outputMatrix[elementId]).filter(
			(transId) => outputMatrix[elementId][transId]
		  ),
          inTransitions: Object.keys(inputMatrix[elementId]).filter(
			(transId) => inputMatrix[elementId][transId]
		  ),
          outArcs: arcPtoT.filter((arc) => arc.src === elementId),
          position: node.getRegistry("position"),
        };
      } else if (node.isTypeOf(META["Transition"])) {
        petriNet.transitions[elementId] = {
          id: elementId,
          name: node.getAttribute("name"),
          outPlaces: Object.keys(inputMatrix).filter(
			(placeId) => inputMatrix[placeId][elementId]
		  ),
          inPlaces: this.findP_T(elementId, outputMatrix),
          outArcs: arcTtoP.filter((arc) => arc.src === elementId),
          position: node.getRegistry("position"),
        };
      }
    });
	this.myNetwork = petriNet.places;
    petriNet.activatedEv = this.activatedEv;
    self._widget.initMachine(petriNet);
	this.showMark();
  };


  SimulationControl.prototype.destroyAll = function () {
    this._networkRootLoaded = false;
    this._widget.destroyMachine();
  };

  SimulationControl.prototype.activatedEv = function (activedTrans) {
    this._fireableEvents = activedTrans;
    if (activedTrans && activedTrans.length >= 1) {
      if (this.toolBarItem.length>0){
			for (var i = this.toolBarItem.length; i--; ) {
				this.toolBarItem[i].hide();
				this.toolBarItem[i].destroy();
			}
		}	
      activedTrans.forEach((transition) => {
        self.$event = WebGMEGlobal.Toolbar.addButton({
          text: `Go path ${transition.name}`, 
          title: `Go path ${transition.name}`, 
          data: { event: transition },
          clickFn: (data) => {
            this._widget.makeItHappen(data.event);
			this.$btnMarking.clear();
			for (var i = this.toolBarItem.length; i--; ) {
				this.toolBarItem[i].destroy();
			}
			const elementIds = this.getChild();
			elementIds.forEach((id,i) => {
			  let node = this._client.getNode(id);
				if (this._client.getNode(node.getMetaTypeId()).getAttribute("name") === "Place") {
					let curName = node.getAttribute("name");
					self.$btnShowMark = this.$btnMarking.addButton({
						  title: "Marking",
						  text: "Marking for "+curName+" is "+"  ",
						  clickFn: function() {
						  },
						});
					}
				});
          },
        });
		this.toolBarItem.push(self.$event);
      });
    } else if (activedTrans && activedTrans.length === 0) {
      this._fireableEvents = null;
    }
	
    this._displayToolbarItems();
  };

  /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
  SimulationControl.prototype.destroy = function () {
    this._detachClientEventListeners();
	if (this._toolbarInitialized === true) {
      for (var i = this._toolbarItems.length; i--; ) {
        this._toolbarItems[i].destroy();
      }
	  if (this.toolBarItem.length>0){
			for (var i = this.toolBarItem.length; i--; ) {
				this.toolBarItem[i].destroy();
			}
		}
    }
  };
  
  SimulationControl.prototype.changeAct = function (
    model,
    activeObjectId
  ) {
    if (this._currentNodeId === activeObjectId) {
    } else {
      this.selectedObjectChanged(activeObjectId);
    }
  };

  SimulationControl.prototype._attachClientEventListeners = function () {
    const self = this;
    self._detachClientEventListeners();
    WebGMEGlobal.State.on(
      "change:" + CONSTANTS.STATE_ACTIVE_OBJECT,
      self.changeAct,
      self
    );
  };

  SimulationControl.prototype._detachClientEventListeners = function () {
    WebGMEGlobal.State.off(
      "change:" + CONSTANTS.STATE_ACTIVE_OBJECT,
      this.changeAct
    );
  };

  SimulationControl.prototype.onActivate = function () {
    this._attachClientEventListeners();
    this._displayToolbarItems();

    if (typeof this._currentNodeId === "string") {
      WebGMEGlobal.State.registerActiveObject(this._currentNodeId, {
        suppressVisualizerFromNode: true,
      });
    }
  };

  SimulationControl.prototype.onDeactivate = function () {
    this._detachClientEventListeners();
    if (this._toolbarInitialized === true) {
      for (var i = this._toolbarItems.length; i--; ) {
        this._toolbarItems[i].hide();
      }
    }
	if (this.toolBarItem.length>0){
		for (var i = this.toolBarItem.length; i--; ) {
				this.toolBarItem[i].destroy();
			}
	}
  };

  /* * * * * * * * * * Updating the toolbar * * * * * * * * * */
  SimulationControl.prototype._displayToolbarItems = function () {
    if (this._toolbarInitialized === true) {
      if (this._fireableEvents === null || this._fireableEvents.length == 0) {
		if (this.toolBarItem.length>0){
			for (var i = this.toolBarItem.length; i--; ) {
				this.toolBarItem[i].hide();
				this.toolBarItem[i].destroy();
			}
		}
		this.$deadLock.show();
        this.$btnResetMachine.show();
		//this.$btnMarking.show();
      } else {
        this.$btnResetMachine.show();
		//this.$btnMarking.show();
		this.$deadLock.hide();
      }
    } else {
      this._initializeToolbar();
	  for(var j = this._toolbarItems.length; j--;){
		  for (var k = this.toolBarItem.length; k--;){
			  if (this._toolbarItems[j].text == this.toolBarItem[k].text){
				  this._toolbarItems[j].destroy();
			  }
		  }
	  }
	  for (var i = this.toolBarItem.length; i--; ) {
				this.toolBarItem[i].hide();
				this.toolBarItem[i].destroy();
			}
    }
  };

  SimulationControl.prototype.getChild = function () {
	  const petriNetNode = this._client.getNode(this._currentNodeId);
	  var myIds = petriNetNode.getChildrenIds();
	  return myIds;
  };
  
  SimulationControl.prototype.showMark = function(){
	  const self = this;
	  self.markingBar = [];
	  const elementIds = self.getChild();
	  self.$btnMarking = WebGMEGlobal.Toolbar.addDropDownButton({
		  text: "See Marking of places  ",
		  title: "See Marking of places",
		});
	  self._toolbarItems.push(self.$btnMarking);
	  self.$btnMarking.show();
	  elementIds.forEach((id) => {
		let node = this._client.getNode(id);
		if (this._client.getNode(node.getMetaTypeId()).getAttribute("name") === "Place") {
			let curName = node.getAttribute("name");
			self.$btnShowMark = self.$btnMarking.addButton({
			  title: "Marking",
			  text: "Cureent Marking for "+curName+" is "+parseInt(node.getAttribute("Marking"))+"  ",
			  clickFn: function () {
			  },
			});
		}
	});
  };

  SimulationControl.prototype._initializeToolbar = function () {
    var toolBar = WebGMEGlobal.Toolbar;
    const self = this;
	var network = this.myNetwork;
	self.toolBarItem = [];
    self._toolbarItems = [];

    self.$btnResetMachine = toolBar.addButton({
      title: "Reset",
      text: "Reset  ",
      clickFn: function () {
        self._widget.resetMachine();
      },
    });
	
	self.$btnPetriNetClassifier = toolBar.addButton({
      text: "Do classification ",
      title: "Classify",
      clickFn: function () {
        var myPlugin = self._client.getCurrentPluginContext();
        myPlugin.pluginConfig = {};
        self._client.runServerPlugin(
          "PetriNetClassifier",
          myPlugin,
        );
      },
    });
	self._toolbarItems.push(self.$btnPetriNetClassifier);

	
	self.$deadLock = toolBar.addButton({
      title: "Deadlock",
      text: "Deadlock, you need reset  ",
      clickFn: function () {
        self._widget.resetMachine();
      },
    });
	self._toolbarItems.push(self.$deadLock);
	self.$deadLock.hide();
    self._toolbarItems.push(self.$btnResetMachine);
    self._toolbarInitialized = true;
  };

  return SimulationControl;
});
