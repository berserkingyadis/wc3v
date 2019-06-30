const utils = require("../helpers/utils"),
      mappings = require("../helpers/mappings");

const Unit = require("./Unit");
const Building = require("./Building");
const SubGroup = require("./SubGroup");

const { 
	abilityActions,
	abilityFlagNames,
	mapStartPositions,
	specialBuildings
} = mappings;

const PlayerActions = class {

	static selectSubGroupWithNoKnownsUnregistered (
		unregisteredUnit,
		player,
		fixedItemId, 
		itemId1, 
		itemId2,
		objectId1,
		objectId2
	) {
		console.logger("selectSubgroup 2");
		console.logger("item ids: ", itemId1, itemId2);
		// re-assign the objectIds1-2 / itemIds1-2
		// because we're now certain for at least this unit

		let existingUnits = player.units.filter(unit => {
			return unit.itemId === fixedItemId &&
						 unit.objectId1 === null;
		});

		// only one of these units is known to exist
		// so we know to update it
		if (existingUnits.length === 1) {
		
			let existingUnit = existingUnits[0];
			existingUnit.registerUnit(fixedItemId, objectId1, objectId2);
			existingUnit.registerItemIds(itemId1, itemId2);
		
		} else if (existingUnits.length > 1) {

			// multiple units found
			// if we found a hero, check illusions
			// if we found a non-hero unit, register

			if (unregisteredUnit.meta.hero) {

				console.logger("Trying to register a hero unit: ", unregisteredUnit);

				let heroUnits = player.units.filter(unit => {
					return (
						unit.itemId === fixedItemId &&
						unit.isIllusion === unregisteredUnit.isIllusion
					);
				});

				console.logger("hero unit check: ", heroUnits);
				throw new Error("stop here");
			}

			if (unregisteredUnit.isUnit) {
				console.logger("trying to register unit.");

				let unregisteredWorker = player.units.find(unit => {
					return unit.objectId1 == null &&
								 unit.itemId === fixedItemId;
				});

				if (unregisteredWorker) {
					console.logger("registering unit: ", itemId1, itemId2);
					unregisteredWorker.registerUnit(fixedItemId, objectId1, objectId2);
					unregisteredWorker.registerItemIds(itemId1, itemId2);
					unregisteredWorker.spawning = false;
					unregisteredWorker.selected = true;
				}
			}

		} else {
			console.logger("WARNING: registering unit with unknown fixedItemId: ", fixedItemId);
			unregisteredUnit.registerUnit(fixedItemId, objectId1, objectId2);
			unregisteredUnit.registerItemIds(itemId1, itemId2);
			unregisteredUnit.spawning = false;
			unregisteredUnit.selected = true;

			console.logger("Unreg unit name: ", unregisteredUnit.displayName);

			player.unregisteredUnitCount--;
		}
		
		player.assignKnownUnits();
		player.updatingSubgroup = false;
	}

	static selectSubGroupWithNoKnowns (
		player,
		fixedItemId, 
		itemId1, 
		itemId2,
		objectId1,
		objectId2
	) {
		console.logger("selectSubgroup 1");
		// look for a unit by the itemId to maybe register
		let unregisteredUnit = player.findUnregisteredUnitByItemId(fixedItemId);

		if (unregisteredUnit) {
			// subGroup 2
			PlayerActions.selectSubGroupWithNoKnownsUnregistered(
				unregisteredUnit,
				player,
				fixedItemId, 
				itemId1, 
				itemId2,
				objectId1,
				objectId2
			);

			return;
		}

		console.logger("selectSubgroup 3");
		console.logger("Filter fixedItemId: ", fixedItemId);

		const unitInfo = mappings.getUnitInfo(fixedItemId);

		let existingUnits = player.units.filter(unit => {
			return unit.itemId === fixedItemId;
		});

		console.logger("existing unit count: ", existingUnits.length);

		const heroIllusionCheck = (unitInfo.meta.hero && existingUnits.length > 1);

		// only one of these units is known to exist
		// so we know to update it
		if (existingUnits.length === 1 || heroIllusionCheck) {
			if (heroIllusionCheck) {
				console.logger("Using new hero illusion check.");
			}

			let existingUnit = existingUnits[0];
			console.logger("updating known unit: ", existingUnit.displayName);

			if (existingUnit.meta.hero) {
				console.logger("Illusion of hero detected.");
					
				let newUnit = new Unit(player.eventTimer, null, null, fixedItemId, false);
				newUnit.registerUnit(fixedItemId, objectId1, objectId2);
				newUnit.registerItemIds(itemId1, itemId2);

				newUnit.isIllusion = true;

				player.addPlayerUnit(newUnit);
				player.unregisteredUnitCount++;

				console.logger("existing:");
				existingUnit.printUnit();

				console.logger("new");
				newUnit.printUnit();

				return;
			}

			existingUnit.registerUnit(fixedItemId, objectId1, objectId2);
			existingUnit.registerItemIds(itemId1, itemId2);
		} else {
			// possibly spawned unit was selected?
			const possibleUnit = mappings.getUnitInfo(fixedItemId);
			if (possibleUnit.isUnit) {
				console.logger(1, "Selected a spawned unit", possibleUnit.displayName);

				if (possibleUnit.meta.hero) {
					console.logger("before exit: ", existingUnits.length);

					console.logger("all units: ", player.units.map(pUnit => pUnit.displayName));

					throw new Error("here");
				}

				console.logger("creating new unit: ", possibleUnit.displayName);
				let newUnit = new Unit(player.eventTimer, null, null, fixedItemId, false);
				newUnit.registerUnit(fixedItemId, objectId1, objectId2);
				newUnit.registerItemIds(itemId1, itemId2);

				player.addPlayerUnit(newUnit);
				player.unregisteredUnitCount++;

				player.printSelectionUnits();
			} else if (fixedItemId === specialBuildings.tavern) {
				console.logger("selected a tavern building");

				let building = new Building(this.eventTimer, null, null, fixedItemId, false);
				building.registerUnit(fixedItemId, objectId1, objectId2);

				// set the tavern to a unique position to avoid false positives on other checks
				building.currentX = -50000;
				building.currentY = -50000;

				player.addPlayerBuilding(building);
				
			
			} else {
				console.logger("^^^^ Unknown action performed: ", fixedItemId);
				console.logger("Possible unit: ", possibleUnit);

				player.printUnits();
			}
		}
		
	}
 
	static registerSubGroupFocusUnit (
		player, 
		unit, 
		fixedItemId, 
		itemId1, 
		itemId2,
		objectId1,
		objectId2
	) {
		console.logger("Registering unit: ", fixedItemId);
		console.logger("new itemIds: ", itemId1, itemId2);
		console.logger("new objIds: ", objectId1, objectId2);

		if (unit.isRegistered) {
			console.logger("not registering already registered unit...");

			if (fixedItemId === "hmpr") {
				console.logger("debug preist");
				player.printUnits();
			}

			if (unit.objectId1 !== objectId1 || unit.objectId2 !== objectId2) {
				console.logger("error? objectid not same?");

				unit.printUnit();

				throw new Error("here 7");
			}

			player.possibleSelectList = player.possibleSelectList.filter(selectionUnit => {
				const foundSelectionUnit = (
					utils.isEqualItemId(selectionUnit.itemId1, itemId1) &&
					utils.isEqualItemId(selectionUnit.itemId2, itemId2)
				);

				return !foundSelectionUnit;
			});

			return;
		}

		unit.registerUnit(fixedItemId, objectId1, objectId2);
		unit.registerItemIds(itemId1, itemId2);
		unit.spawning = false;
		unit.selected = true;

		player.updatingSubgroup = false;
		player.assignKnownUnits();
	}

	static registerTabSwitch (
		player,
		firstGroupUnit,
		newlyRegisteredUnits,
		fixedItemId,
		itemId1,
		itemId2,
		objectId1,
		objectId2
	) {
		const unitInfo = mappings.getUnitInfo(fixedItemId);
		const switchedUnit = player.findUnitByObjectId(objectId1, objectId2);

		let finalSwitchedUnit;

		if (switchedUnit) {
			console.logger("switching to: ", switchedUnit.displayName);

			player.printSelectionUnits();

			console.logger("Registering objectIds to unit: ", objectId1, objectId2);
			switchedUnit.registerObjectIds(objectId1, objectId2);
			finalSwitchedUnit = switchedUnit;
		} else {
			console.logger("WARNING: unable to find tab switch unit. looking for: ", itemId1, itemId2);

			const switchUnitByItemIds = player.findUnregisteredUnitByItemIds(itemId1, itemId2);
			if (switchUnitByItemIds && switchUnitByItemIds.itemId === fixedItemId) {
				console.logger("found switch unit to register: ", switchUnitByItemIds);
				console.logger("Registering objectIds to unit: ", objectId1, objectId2);
				switchUnitByItemIds.registerObjectIds(objectId1, objectId2);
				finalSwitchedUnit = switchUnitByItemIds;
			} else {
				console.logger("ERROR: could not find unreg unit by itemId.");

				// todo: probably can still regeister unreg units here

				if (newlyRegisteredUnits.length > 1) {
					console.logger("WARNING: multiple newly registered units");
				}

				if (!newlyRegisteredUnits.length) {
					// try to find a unit by itemId

					const switchUnitByItemId = player.findUnregisteredUnitByItemId(fixedItemId);

					if (switchUnitByItemId) {
						console.logger("found unit by itemId");
						switchUnitByItemId.printUnit();

						finalSwitchedUnit = switchUnitByItemId;
					} else {
						player.printUnits();
						player.printSelectionUnits();

						console.logger("test unit: ", player.findUnitByObjectId(objectId1, objectId2));

						const { meta } = unitInfo;

						if (!meta.permanent) {
							console.logger("WARNING: creating found non-permanent unit: ", unitInfo.displayName);

							let newUnit = new Unit(player.eventTimer, null, null, fixedItemId, false);
							newUnit.registerUnit(fixedItemId, objectId1, objectId2);
							newUnit.registerItemIds(itemId1, itemId2);

							player.addPlayerUnit(newUnit);
							finalSwitchedUnit = newUnit;
						} else {
							throw new Error("unable to find tab switch permanent unit.");	
						}
					}
				} else {
					// register our newly registered unit 
					finalSwitchedUnit = newlyRegisteredUnits[0];	
				}
				

				if (!finalSwitchedUnit) {
					throw new Error("here bad");
				}
				
				player.printSelectionUnits();
				player.printUnits();

			}
		}

		let unitSelectionIndex = player.selection.units.findIndex(selectionUnit => {
			return utils.isEqualItemId(selectionUnit.itemId1, finalSwitchedUnit.itemId1) &&
						 utils.isEqualItemId(selectionUnit.itemId2, finalSwitchedUnit.itemId2)
		});

		if (unitSelectionIndex === -1) {
			finalSwitchedUnit.printUnit();
			
			console.logger("raw sel: ", player.selection.units);
			console.logger("index? ", unitSelectionIndex);
			console.logger("newly reg:", newlyRegisteredUnits);

			finalSwitchedUnit.registerUnit(fixedItemId, objectId1, objectId2);
			player.selection = new SubGroup(1, [{itemId1: finalSwitchedUnit.itemId1, itemId2: finalSwitchedUnit.itemId2}]);

			return;			
		}

		// move the selection to the 0 position in the selection list
		console.logger("swapping: ", unitSelectionIndex, 0);
		player.selection.swapUnitPosition(unitSelectionIndex, 0);
	}
};

module.exports = PlayerActions;