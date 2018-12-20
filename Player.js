const utils = require("./utils"),
      mappings = require("./mappings");

const { 
	abilityActions,
	abilityFlagNames,
	mapStartPositions 
} = mappings;

const Unit = require("./Unit"),
      SubGroup = require("./SubGroup");

const SelectModes = {
	select: 1,
	deselect: 2
};

const Player = class {
	constructor (id, playerSlot) {
		this.id = id;
		this.playerSlot = playerSlot;
		this.teamId = playerSlot.teamId;
		this.race = playerSlot.raceFlag;

		switch (this.race) {
			case 'O':
				this.units = [
					new Unit(null, null, 'opeo', true),
					new Unit(null, null, 'opeo', true),
					new Unit(null, null, 'opeo', true),
					new Unit(null, null, 'opeo', true),
					new Unit(null, null, 'opeo', true),
					new Unit(null, null, 'ogre', true)
				];

				this.unregisteredUnitCount = 6;
			break;
			case 'H':
				this.units = [
					new Unit(null, null, 'hpea', true),
					new Unit(null, null, 'hpea', true),
					new Unit(null, null, 'hpea', true),
					new Unit(null, null, 'hpea', true),
					new Unit(null, null, 'hpea', true),
					new Unit(null, null, 'ogre', true)
				];

				this.unregisteredUnitCount = 6;
			break;
			case 'E':
				this.units = [
					new Unit(null, null, 'ewsp', true),
					new Unit(null, null, 'ewsp', true),
					new Unit(null, null, 'ewsp', true),
					new Unit(null, null, 'ewsp', true),
					new Unit(null, null, 'ewsp', true),
					new Unit(null, null, 'ogre', true)
				];

				this.unregisteredUnitCount = 6;
			break;
			case 'U':
				this.units = [
					new Unit(null, null, 'uaco', true),
					new Unit(null, null, 'uaco', true),
					new Unit(null, null, 'uaco', true),
					new Unit(null, null, 'unpl', true)
				];

				this.unregisteredUnitCount = 4;
			break;
			default:
				this.units = [];
			break;
		};

		this.startingPosition = null;
		this.updatingSubgroup = false;
		this.selection = null;
		this.groupSelections = {};

		this.buildMenuOpen = false;

		this.possibleRegisterItem = null;
		this.possibleSelectList = [];

		this.knownObjectIds = {
			'worker': null,
			'townhall': null
		};
	}

	makeUnit (itemId1, itemId2) {
		let unit = new Unit(itemId1, itemId2);

		this.units.push(unit);
	}

	findUnit (itemId1, itemId2) {
		return this.units.find(unit => {
			return utils.isEqualItemId(unit.itemId1, itemId1) && 
			       utils.isEqualItemId(unit.itemId2, unit.itemId2);
		});
	}

	findUnregisteredUnit () {
		return this.units.find(unit => {
			return unit.objectId1 === null;
		});
	}

	findUnregisteredBuilding () {
		return this.units.find(unit => {
			return unit.isBuilding && unit.itemId1 == null;
		});
	}

	findUnregisteredUnitByItemId (itemId) {
		return this.units.find(unit => {
			return unit.itemId === itemId;
		});
	}

	findUnregisteredUnitByItemIds (itemId1, itemId2) {
		return null;
	}

	getSelectionUnits () {
		const self = this;
		if (!this.selection) {
			return [];
		}

		return this.selection.units.reduce((acc, unitItem) => {
			const { itemId1, itemId2 } = unitItem;
			const unit = self.findUnit(itemId1, itemId2);

			if (unit) {
				acc.push(unit);
			}

			return acc;
		}, []);
	}

	toggleUpdateSubgroup (action) {
		// auto-gen war3 message was triggered
		this.updatingSubgroup = true;
	}

	assignKnownUnits () {
		let self = this;
		let knownObjectIds = this.knownObjectIds;

		const shouldCheckAssignments = Object.keys(knownObjectIds).some(key => {
			return knownObjectIds[key] === null;
		});

		if (!shouldCheckAssignments) {
			return;
		}

		this.units.forEach(unit => {
			if (!unit.isSpawnedAtStart || unit.objectId1 === null) {
				return;
			}

			if (!knownObjectIds.worker && unit.meta.worker) {
				knownObjectIds.worker = unit.objectId1;
			} else if (!knownObjectIds.townhall && unit.isBuilding) {
				knownObjectIds.townhall = unit.objectId1;
			}
		});
	}

	guessUnitType (objectId) {
		console.log("Guessing a unit type from objectId: ", objectId);
		console.log("Known objects: ", this.knownObjectIds);
		const knownObjectIds = this.knownObjectIds;
		const threshold = 6;

		let bestGuess = Object.keys(knownObjectIds).find(key => {
			const knownId = knownObjectIds[key];
			if (knownId === null) {
				return false;
			}

			return Math.abs(knownId - objectId) <= threshold;
		});

		return bestGuess || null;
	}

	assignPossibleSelectGroup (itemId) {
		let self = this;
		let registeredUnits = [];
		let registerCount = 0;

		const selectionSize = this.selection.numberUnits;
		console.log("Starting assignPossibleSelectGroup", itemId);

		this.selection.units.forEach(selectionUnit => {
			self.possibleSelectList.find(selectItem => {
				const { itemId1, itemId2 } = selectItem;

				const foundSelectionUnit = (
					utils.isEqualItemId(selectionUnit.itemId1, itemId1) &&
					utils.isEqualItemId(selectionUnit.itemId2, itemId2)
				);

				if (foundSelectionUnit) {
					let foundPlayerUnit = self.units.find(playerUnit => {
						return playerUnit.itemId === itemId && // same unit as selection
						       playerUnit.itemId1 === null;
					});

					if (foundPlayerUnit) {
						foundPlayerUnit.registerItemIds(itemId1, itemId2);
						self.unregisteredUnitCount -= 1;

						console.log("Found and registered unit: ", foundPlayerUnit.displayName);
						registeredUnits.push(foundPlayerUnit);
						return true;
					} else {
						return false;
					}
				} else {
					return false;
				}
			});
		});

		return registeredUnits;
	}

	selectSubgroup (action) {
		console.log("% Player.selectSubgroup");

		const { itemId, objectId1, objectId2 } = action;
		const firstGroupItem = this.selection.units[0];
		const {itemId1, itemId2} = firstGroupItem;

		const fixedItemId = utils.fixItemId(itemId);

		let newlyRegisteredUnits = [];
		let firstGroupUnit = this.findUnit(itemId1, itemId2);
		let playerHasUnregisteredUnits = (this.unregisteredUnitCount > 0);

		if (playerHasUnregisteredUnits) {
			newlyRegisteredUnits = this.assignPossibleSelectGroup(fixedItemId);
		}

		if (!firstGroupUnit && !newlyRegisteredUnits.length) {
			console.log("No first group unit, has unreg.");
			let unregisteredUnit = this.findUnregisteredUnitByItemId(fixedItemId);
			
			if (unregisteredUnit) {
				console.log("reg unit", fixedItemId);
				unregisteredUnit.registerUnit(fixedItemId, objectId1, objectId2);
				
				this.unregisteredUnitCount -= 1;
				this.assignKnownUnits();

				unregisteredUnit.spawning = false;
				unregisteredUnit.selected = true;

				this.updatingSubgroup = false;
			} else {

				// todo: is this needed?
				console.log("@@ stored register ", unregisteredUnit);
				this.possibleRegisterItem = action;	
			}
		} else {

			if (!firstGroupUnit) {
				console.log("%% could not find unit in selection group.");
				console.log("Selection: ", this.selection);
			} else {
				console.log("At bottom?");
				// we're certain about this unit being our selection
				firstGroupUnit.registerUnit(fixedItemId, objectId1, objectId2);

				this.assignKnownUnits();

				firstGroupUnit.spawning = false;
				firstGroupUnit.selected = true;

				this.updatingSubgroup = false;
			}
		}
	}

	changeSelection (action) {
		const self = this;
		const subActions = action.actions;
    const selectMode = action.selectMode;
    const numberUnits = action.numberUnits;

    let hasUnregisteredUnitFlag = false;
    let subGroup = new SubGroup(numberUnits, subActions);

    if (selectMode === SelectModes.select) {
    	// register first-time selected units
    	subActions.forEach(subAction => {
    		const {itemId1, itemId2} = subAction;
    		let unit = self.findUnit(itemId1, itemId2);
    		
    		console.log("changeSelection unit: ", unit);
    		if (!unit) {
    			const playerHasUnregisteredUnits = (self.unregisteredUnitCount > 0);
    			if (playerHasUnregisteredUnits) {
    				// we can't know for sure
    				// that this unit needs to be made or registered yet

    				console.log("Added unit to possible select list.");
    				this.possibleSelectList.push({
    					itemId1: itemId1,
    					itemId2: itemId2
    				});

    				hasUnregisteredUnitFlag = true;
    			} else {
    				console.error("No unit found and no unregistered units!");
    			}
    		}
    	});

    	if (this.selection === null) {
    		// no sub-group yet.  assign our newly selected one
    		this.selection = subGroup;	
    	} else {
    		// merge our selected sub groups
    		this.selection.mergeGroups(subGroup);
    	}

    	if (hasUnregisteredUnitFlag) {
    		this.selection.hasUnregisteredUnit = true;
    	}	
    } else {
    	// de-selected unit
    	this.selection.deselect(subGroup);
    }
	}

	useAbilityNoTarget (action) {
		console.log("% Player.useAbilityNoTarget");

		const isItemArray = Array.isArray(action.itemId);
		const itemId = isItemArray ?
			action.itemId : utils.fixItemId(action.itemId);
		const abilityFlags = action.abilityFlags;
		
		let selectedUnits = this.getSelectionUnits();

		if (selectedUnits.length) {
			let firstUnit = selectedUnits[0];

			if (isItemArray) {
				if (firstUnit.meta.hero) {
					const abilityActionName = utils.findItemIdForObject(itemId, abilityActions);
					switch (abilityActionName) {
						case 'CastSummonSkill':
							console.log("Unit called summon skill: ", firstUnit.displayName);

							let skill = firstUnit.getSkillForType("summon");
							console.log("Skill: ", skill);

							if (!skill) {
								console.error("Cound not find skill.", firstUnit);
								return;
							}

							const {summonCount, summonItemId } = skill;
							for (let i = 0; i < summonCount; i++) {
								console.log("Making unit: ", i, summonItemId);

								let summonUnit = new Unit(null, null, summonItemId, false);
								
								this.units.push(summonUnit);
								this.unregisteredUnitCount += 1;
							}
						break;

						default:
							console.log("Unknown ability with no target.");
						break;
					};
				}

				return;
			}

			
			if (firstUnit.isBuilding) {
				let spellInfo = mappings.getUnitInfo(itemId);

				if (spellInfo && spellInfo.isUnit) {
					console.log("%% spawned unit:", spellInfo.displayName);
					let newUnit = new Unit(null, null, itemId, false);
					
					this.units.push(newUnit);
					this.unregisteredUnitCount += 1;
				}

				return;
			}

			switch (abilityFlags) {
				// learn skill
				case abilityFlagNames.LearnSkill:
					// training skill
					if (firstUnit.meta.hero) {
						console.log("%% Hero learning spell.");

						// TODO: only do this when abilityFlags is 0x42
						// TODO: otherwise we have an itemId array
						//       and some other ability flag to inspect?

						let spell = mappings.heroAbilities[itemId];
						if (!firstUnit.learnedSkills[itemId]) {
							// learning first level
							spell.level = 1;

							firstUnit.learnedSkills[itemId] = spell;
							console.log("%% Learned spell: ", spell);
						} else {
							firstUnit.learnedSkills[itemId].level += 1;
							firstUnit.knownLevel += 1;

							console.log("Leveled up skill: ", firstUnit.learnedSkills[itemId]);
						}
						
					}
				break;

				default:
					console.log("No match for ability flag: ", abilityFlags.LearnSkill);
					console.log("Test: ", abilityFlagNames);

					console.log("Action was: ", action);
				break;
			};
			
		}

		if (this.possibleRegisterItem) {
			// todo: is this needed?

			console.log("%%% unit called an ability that might be unreg.", itemId);

			// note: we also have the possible reg item itemId
			//       to use to verify the possible reg item is valid

			let targetItemId = null;
			let targetUnitInfo = mappings.getUnitInfo(itemId);

			if (targetUnitInfo.isUnit) {
				// ability is making a unit
				const meta = targetUnitInfo.meta;
				if (meta.hero) {
					// alter of storms
					targetItemId = "oalt";
				}
			}

			if (targetItemId) {
				// found a target to try and assign
				let possibleUnit = this.UnregisteredUnitByItemId(targetItemId);

				if (possibleUnit) {
					const { itemId, objectId1, objectId2 } = this.possibleRegisterItem;

					if (utils.fixItemId(itemId) === possibleUnit.itemId) {
						// note: maybe use this?
					}

					// TOOD: maybe swap object ids around here?

					possibleUnit.registerObjectIds(objectId1, objectId2);
					this.unregisteredUnitCount -= 1;
				}
			}
		}
	} 

	useAbilityWithTargetAndObjectId (action) {
		let units = this.getSelectionUnits();
		let firstUnit = units[0];

		const abilityActionName = utils.findItemIdForObject(action.itemId, abilityActions);
		switch (abilityActionName) {
			case 'CastSkillTarget':
				console.log("Casting target skill at point.");
				console.log("Unit casting: ", firstUnit.displayName);

				if (firstUnit.meta.hero) {
					console.log("Hero CastSkillTarget spell.");

					let skill = firstUnit.getSkillForType("pointTarget");

					if (!skill) {
						console.log("Couldnt find pointTarget skill for unit: ", firstUnit);
						return;
					}

					console.log("Casting point target skill: ", skill);
				}
			break;
			case 'CastSkillObject':
				console.log("casting skill on object target.");
				console.log("Unit casting: ", firstUnit.displayName);

				if (firstUnit.meta.hero) {
					console.log("Hero CastSkillObject spell.");
					let skill = firstUnit.getSkillForType("objectTarget");

					if (!skill) {
						console.log("Couldnt find objectTarget skill for unit: ", firstUnit);
						return;
					}
					
					console.log("Casting object target skill: ", skill);
				}
			break;
			case 'RightClick':
				let { 
					targetX, 
					targetY,
					objectId1,
					objectId2
				} = action;

				if (objectId1 === -1 && objectId2 === -1) {
					// clicked on ground
				} else {
					// clicked object directly

					let clickedUnit = this.units.find(unit => {
						return unit.objectId1 === objectId1 &&
									 unit.objectId2 === objectId2;
					});

					if (!clickedUnit) {
						console.log("** Clicked a non-existing unit", objectId1, objectId2);
						let unitGuess = this.guessUnitType(objectId1);
						
						if (!unitGuess) {
							console.log("%%% clicked something not near known object ids");
						}
					}
				}
				
				units.forEach(unit => {
					unit.moveTo(targetX, targetY);
				});
			break;
		}
	}

	useAbilityWithTarget (action) {
		console.log("% Player.useAbilityWithTarget");

		const selectionUnits = this.getSelectionUnits();

		console.log("Selection units: ", selectionUnits);
		console.log("Selection: ", this.selection.units[0]);

		let firstUnit = selectionUnits[0];

		if (!firstUnit && this.selection.hasUnregisteredUnit) {
			console.log("Unregistered unit used ability. Maybe worker?");
		}

		if (this.buildMenuOpen && firstUnit.meta.worker) {
			const { targetX, targetY, itemId } = action;
			const startingPosition = {
				x: targetX,
				y: targetY
			};

			console.log("# Made a building");
			let building = new Unit(null, null, startingPosition);
			building.registerUnit(utils.fixItemId(itemId), null, null);

			this.unregisteredUnitCount += 1;
			this.units.push(building);
		}
	}

	chooseBuilding (action) {
		this.buildMenuOpen = true;
	}

	assignGroupHotkey (action) {
		const { 
			groupNumber, 
			numberUnits,
			actions
		} = action;

		console.log("Assign group hotkey: ", groupNumber, numberUnits);
		this.groupSelections[groupNumber] = new SubGroup(numberUnits, actions);
	}

	selectGroupHotkey (action) {
		const { groupNumber } = action;

		if (this.groupSelections[groupNumber]) {
			console.log("Selecing group:", groupNumber);	

			// todo: add group deselectAll
			this.selection = this.groupSelections[groupNumber];
		} else {
			console.error("selected group that didnt exist?");
		}
		
	}
};

module.exports = Player;