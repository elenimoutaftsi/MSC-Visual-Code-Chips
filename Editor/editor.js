import { AliasedGrammarSymbol, DefinitionRhs, Language} from '../Language.js'
import { assert } from "../Utils/Assert.js";
import { EditorElement, EditorElementTypes, EditorElementViewMode } from './EditorElements/EditorElement.js'
import { Group } from './EditorElements/Group.js'
import { InputBlock } from './EditorElements/InputBlock.js'
import { NewLine } from './EditorElements/NewLine.js'
import { SelectionBlock } from './EditorElements/SelectionBlock.js'
import { SimpleBlock } from './EditorElements/SimpleBlock.js'
import { TabBlock } from './EditorElements/TabBlock.js'
import { KeyboardEventManager } from '../Utils/KeyboardEventManager.js'
import { Toolbox } from './Toolbox/Toolbox.js';
import { EditorElementParser } from './EditorElements/EditorElementParser.js';
import { ContextMenu } from './ContextMenu.js';
import { GenerationPathPopup } from './EditorPopups/GenerationPathPopup.js';
import { CommandHistory } from '../Utils/Command.js';
import { ChooseCommand } from './EditorCommands/ChooseCommand.js';
import { IndentCommand } from './EditorCommands/IndentCommand.js';
import { OutdentCommand } from './EditorCommands/OutdentCommand.js';
import { NewLineCommand } from './EditorCommands/NewLineCommand.js';
import { PasteCommand } from './EditorCommands/PasteCommand.js';
import { DeleteCommand } from './EditorCommands/DeleteCommand.js';
import { DeleteUntilPossibleCommand } from './EditorCommands/DeleteUntilPossibleCommand.js';
import { DeleteAllCommand } from './EditorCommands/DeleteAllCommand.js';
import { UndoRedoToolbar } from './UndoRedoToolbar/UndoRedoToolbar.js';
import { DownloadAsFile } from '../Utils/Download.js';
import { ToastMessage } from './EditorToastMessages/ToastMessage.js';
import { InvisibleBlock } from './EditorElements/InvisibleBlock.js';
import { RepetitionGroup } from './EditorElements/RepetitionGroup.js';
import { CreateRepetitiveElemCommand } from './EditorCommands/CreateRepetitiveElemCommand.js';
import { ReorderUpCommand } from './EditorCommands/ReorderUpCommand.js';
import { ReorderDownCommand } from './EditorCommands/ReorderDownCommand.js';
import { DropCommand } from './EditorCommands/DropCommand.js';
import { Theme } from './Theme.js';

export class Editor {

    $container;
    $editor;

    $workspace;
    $code;
    $rightClickContainer;
    $toastMessages;
    
    $toolboxspace;
    
    language;
    code;
    clipboard;
    selected;
    
    $undoRedoToolbarContainer;
    undoToolbarVisible = false;
    undoToastMessageVisible = false;
    undoToastMessageDisabled = false;
    undoToastMessage;
    undoToolbar;

    viewMode = EditorElementViewMode.BlockView;

    keyboardEventManager;
    
    draggedElem;
    dropTarget;
    dropPlaceholderIndex;
    $dropPlaceholder = $('<div/>').append(
        $('<div/>').addClass('overlay'),
        $('<div/>').addClass('content')
    ).addClass('drop-placeholder');

    generationPathPopup;

    typeValidators = {
        INT : (text) => {
            return Number.isInteger(Number(text));
        },
        FLOAT: (text) => {
            return Number.isFinite(Number(text));
        },
        CHAR: (text) => {
            return text.length === 1;
        },
        STRING: (text) => {
            return true;
        },
        BOOL: (text) => {
            return text === 'true' || text === 'false';
        },
        IDENTIFIER: (text) => {
            let matched = /[_A-Za-z]+[_A-Za-z0-9]*/g.exec(text);
            return matched && matched[0] === text;
        }
    };

    commands = new CommandHistory();
    theme;

    constructor($container, language, toolboxInfo, themeJson){
        this.$container = $container;
        this.language = language;
        this.SetTheme(themeJson);

        this.InitializeCode_();
        this.InitializeView_();
        this.InitializeEvents_();
        this.SetUpContextMenu_();

        this.SetUpToolbox_(toolboxInfo);
        this.SetUpUndoToolbar_();

        this.SetWorkspace_DragAndDrop();
        this.Render();
    }

    IsCorrectTheme(theme){
        //todo
        return true;
    }

    CreateGeneralBlockThemeStructure(){
        let blockThemes = {};

        let blockClasses = [ Group, RepetitionGroup, SimpleBlock, InputBlock, SelectionBlock ];
        
        for (let blockClass of blockClasses){
            blockThemes[blockClass.name] = {};

            for (let themable of blockClass.themeables){
                blockThemes[blockClass.name][themable.id] = {};

                for (let prop of themable.themeable.props){
                    blockThemes[blockClass.name][themable.id][prop] = '';
                }
            }
        }

        return blockThemes;
    }

    CreateSpecificBlockThemeStructure(){
        let blockThemes = {};

        for (let symbol of [...this.language.GetTerminals(), ...this.language.GetNonTerminals()]){
            blockThemes[symbol.name] = {};
            
            let blockClass = this.PeekElemType(symbol);

            if (!blockClass)
                continue;

            for (let themable of blockClass.themeables){
                blockThemes[symbol.name][themable.id] = {};

                for (let prop of themable.themeable.props){
                    blockThemes[symbol.name][themable.id][prop] = '';
                }
            }
        }

        return blockThemes;
    }

    CreateThemeStructure(){
        let themes = {};

        let blockThemes = {};
        blockThemes['General'] = this.CreateGeneralBlockThemeStructure();
        blockThemes['Specific'] = this.CreateSpecificBlockThemeStructure();
        
        themes['Blocks'] = blockThemes;

        return themes;
    }

    CalculateCompositeBlockTheme(theme){
        theme["Blocks"]["Composite"] = {};

        for (let symbol of [...this.language.GetTerminals(), ...this.language.GetNonTerminals()]){
            let blockClass = this.PeekElemType(symbol);

            if (!blockClass)
                continue;

            let general = theme["Blocks"]["General"][blockClass.name];
            let specific = theme["Blocks"]["Specific"][symbol.name];
            let composite = theme["Blocks"]["Composite"][symbol.name] = {};
            
            for (let themeable of blockClass.themeables){
                composite[themeable.id] = {};

                for (let prop of themeable.themeable.props){
                    if (specific[themeable.id][prop] !== '' && specific[themeable.id][prop] !== undefined)
                        composite[themeable.id][prop] = specific[themeable.id][prop];
                    else if (general[themeable.id][prop] !== '' && general[themeable.id][prop] !== undefined)
                        composite[themeable.id][prop] = general[themeable.id][prop];
                }

                composite[themeable.id] = new Theme(composite[themeable.id]);
            }
        }
    }

    SetTheme(theme){
        if (!this.IsCorrectTheme(theme)) return;

        this.CalculateCompositeBlockTheme(theme);

        this.theme = theme;
    }

    InitializeCode_(){
        let startingSymbol = new AliasedGrammarSymbol(this.language.GetSymbol('program', false));
        this.code = this.CreateElem(startingSymbol);
        this.BindRootElemToEditor_(this.code);
    }

    InitializeView_(){
        this.$workspace = $('<div/>').addClass('workspace');

        this.$code = $('<div/>').addClass('code');
        this.$contextMenuContainer = $('<div/>').addClass('context-menu-container');
        this.$undoRedoToolbarContainer = $('<div/>').addClass('editor-undo-redo-toolbar-container');
        this.$toastMessages = $('<div/>').addClass('editor-toast-messages');

        this.$workspace.append(
            this.$undoRedoToolbarContainer,
            this.$code,
            this.$toastMessages,
            this.$contextMenuContainer
        );

        this.$toolboxspace = $('<div/>').addClass('toolboxspace');

        this.$editor = $('<div/>').addClass('editor');
        this.$editor.append(this.$toolboxspace, this.$workspace);
        
        this.$editor.on('click', () => {
            this.$contextMenuContainer.empty();
        });
        this.$workspace.on('click', ()=> {
            this.Select(undefined);
        });

        this.$container.empty();
        this.$container.append(this.$editor);
    }

    InitializeEvents_(){
        const Keys = KeyboardEventManager.Keys;
        
        let EvHandler = (f) => {
            return () => {
                if (this.viewMode === EditorElementViewMode.PureTextView)
                    return;

                f();
            };
        };

        this.keyboardEventManager = new KeyboardEventManager(this.$workspace)
            .AddEventHandler( [Keys.ALT, Keys.UP],                  EvHandler(() => this.EventHandler_ReorderUp_()) )
            .AddEventHandler( [Keys.ALT, Keys.DOWN],                EvHandler(() => this.EventHandler_ReorderDown_()) )
            .AddEventHandler( [Keys.UP],                            EvHandler(() => this.EventHandler_NavigateUp_()) )
            .AddEventHandler( [Keys.DOWN],                          EvHandler(() => this.EventHandler_NavigateDown_()) )
            .AddEventHandler( [Keys.LEFT],                          EvHandler(() => this.EventHandler_NavigateLeft_()) )
            .AddEventHandler( [Keys.RIGHT],                         EvHandler(() => this.EventHandler_NavigateRight_()) )
            .AddEventHandler( [Keys.ONE],                           EvHandler(() => this.EventHandler_NavigateIn_()) )
            .AddEventHandler( [Keys.TWO],                           EvHandler(() => this.EventHandler_NavigateOut_()) )
            .AddEventHandler( [Keys.BACKSPACE],                     EvHandler(() => this.EventHandler_Backspace_()) )
            .AddEventHandler( [Keys.CTRL, Keys.A, Keys.DELETE],     EvHandler(() => this.EventHandler_DeleteAll_()) )
            .AddEventHandler( [Keys.ALT, Keys.DELETE],              EvHandler(() => this.EventHandler_DeleteUntilPossible_()) )
            .AddEventHandler( [Keys.DELETE],                        EvHandler(() => this.EventHandler_Delete_()) )
            .AddEventHandler( [Keys.ENTER],                         EvHandler(() => this.EventHandler_NewLine_()) )
            .AddEventHandler( [Keys.SHIFT, Keys.TAB],               EvHandler(() => this.EventHandler_Outdent_()) )
            .AddEventHandler( [Keys.TAB],                           EvHandler(() => this.EventHandler_Indent_()) )
            .AddEventHandler( [Keys.CTRL, Keys.X],                  EvHandler(() => this.EventHandler_Cut_()) )
            .AddEventHandler( [Keys.CTRL, Keys.C],                  EvHandler(() => this.EventHandler_Copy_()) )
            .AddEventHandler( [Keys.CTRL, Keys.V],                  EvHandler(() => this.EventHandler_Paste_()) )
            .AddEventHandler( [Keys.CTRL, Keys.Z],                  EvHandler(() => this.EventHandler_Undo_()) )
            .AddEventHandler( [Keys.CTRL, Keys.Y],                  EvHandler(() => this.EventHandler_Redo_()) )
            .AddEventHandler( [Keys.CTRL, Keys.M],                  () => this.EventHandler_ToggleViewMode() )
        ;
    }

    SetUpUndoToolbar_(){
        this.undoToolbar = new UndoRedoToolbar(this.$undoRedoToolbarContainer);
        this.undoToolbar.SetOnUndo( () => this.EventHandler_Undo_() );
        this.undoToolbar.SetOnRedo( () => this.EventHandler_Redo_() );
        
        this.undoToolbar.SetOnShow(() => this.undoToolbarVisible = true );

        this.undoToolbar.SetOnHide(() => { 
            this.undoToolbarVisible = false;
            this.undoToastMessage?.Destroy();
            this.undoToastMessageVisible = false;
        });
    }

    SetUpToolbox_(toolboxInfo){
        this.toolbox = new Toolbox(this.$toolboxspace, toolboxInfo, this.theme);
        this.toolbox.SetToolbox_MaxWidth(() => {
            return 0.8 * this.$container.width();
        });
        this.toolbox.SetToolbox_MinWidth(() => {
            return 0.2 * this.$container.width();
        });
    }

    SetUpContextMenu_(){
        this.$workspace.on('contextmenu', (e) => {
            e.preventDefault();
            this.Select(undefined);
            
            this.$contextMenuContainer.empty();

            let contextMenu = new ContextMenu(this.$contextMenuContainer, [
                [
                    {
                        name: 'Undo',
                        shortcut: 'Ctrl+Z',
                        disabled: this.viewMode === EditorElementViewMode.PureTextView || !this.commands.GetUndoSize(),
                        handler: () => this.EventHandler_Undo_()
                    },
                    {
                        name: 'Redo',
                        shortcut: 'Ctrl+Y',
                        disabled: this.viewMode === EditorElementViewMode.PureTextView || !this.commands.GetRedoSize(),
                        handler: () => this.EventHandler_Redo_()
                    },
                ],
                [
                    {
                        name: 'Import Visual Code',
                        shortcut: 'Ctrl+L',
                        disabled: this.viewMode === EditorElementViewMode.PureTextView,
                        needsFile: true,
                        handler: (files) => this.EventHandler_LoadCode_(files)
                    },
                    {
                        name: 'Download Visual Code',
                        shortcut: 'Ctrl+S',
                        handler: () => this.EventHandler_DownloadCode_()
                    }
                ],
                [
                    {
                        name: this.viewMode === EditorElementViewMode.BlockView ? 'View Code As Text' : 'View Code As Blocks',
                        shortcut: 'Ctrl+M',
                        handler: () => this.EventHandler_ToggleViewMode()
                    }
                ],
                [
                    {
                        name: 'Delete All',
                        shortcut: 'Ctrl+A+Del',
                        disabled: this.viewMode === EditorElementViewMode.PureTextView,
                        handler: () => this.EventHandler_DeleteAll_()
                    }
                ],
            ]);

            contextMenu.Render();

            this.FitContextMenu_(e);
        });
    }

    FitContextMenu_(e){
        let clickOffsetX = e.pageX - this.$workspace.offset().left, clickOffsetY = e.pageY - this.$workspace.offset().top;
            
        let positionX = 
            clickOffsetX + this.$contextMenuContainer.width() < this.$workspace.width() ? clickOffsetX :
            clickOffsetX - this.$contextMenuContainer.width() >= 0 ? clickOffsetX - this.$contextMenuContainer.width() :
            clickOffsetX; // will be unavoidably outside the container...

        let positionY =
            clickOffsetY + this.$contextMenuContainer.height() < this.$workspace.height() ? clickOffsetY :
            clickOffsetY - this.$contextMenuContainer.height() >= 0 ? clickOffsetY - this.$contextMenuContainer.height() :
            clickOffsetY; // will be unavoidably outside the container...
            
        this.$contextMenuContainer.css('left', positionX);
        this.$contextMenuContainer.css('top', positionY);
    }

    CanRemoveElem(elem){
        return  elem?.GetParent() && 
                (
                    elem.GetGeneratedBy() ||
                    elem.GetParent().GetType() === EditorElementTypes.RepetitionGroup ||
                    elem.GetType() === EditorElementTypes.Tab || 
                    elem.GetType() === EditorElementTypes.NewLine
                );
    }

    RemoveElem_WithChecks(elem){
        if (!this.CanRemoveElem(elem)) return false;

        let parent = elem.GetParent(), generatedBy = elem.GetGeneratedBy();

        if (generatedBy){
            parent.InsertAfterElem(elem, generatedBy);
            this.Select(generatedBy);
        }

        if (elem === this.selected){
            this.NavigateLeft() || this.NavigateOut() || (this.selected = undefined);
        }

        parent.RemoveElem(elem);

        return true;
    }

    Select(elem) {
        if (this.selected) {
            this.selected.GetCustomizableView()?.removeClass('selected');
        }
        elem?.GetCustomizableView()?.addClass('selected');
        this.selected = elem;
    }

    Render(){
        this.RenderWorkspace();
    }

    SetWorkspace_DragAndDrop() {
        this.toolbox.SetElem_OnDragStart((e, elem) => {
            this.$contextMenuContainer.empty();
            this.draggedElem = elem;
            this.FillDropPlaceholder(this.draggedElem);
            this.HighlightValidPasteTargets(this.draggedElem);
        });

        this.toolbox.SetElem_OnDragEnd((e, elem) => {
            this.RemoveDropPlaceholder();
            this.RemoveHighlights();
        });

        this.toolbox.SetToolbox_OnDrop((e, elem) => {
            this.RemoveDropPlaceholder();
            this.RemoveHighlights();
        });

        this.$workspace.on('dragover', (e) => {
            e.preventDefault();
        });
    }

    RenderWorkspace(){
        let scrollTop = this.$code.scrollTop();
        this.$code.empty();
        this.code.Render(this.$code);
        this.$code.append($('<div/>').addClass('fill'));
        this.$code.scrollTop(scrollTop);
        if (this.selected){
            this.Select(this.selected);
        }
    }

    BindRootElemToEditor_(elem){
        elem.SetDraggable(false);
        elem.SetOnClick(() => {
            this.$contextMenuContainer.empty();
            this.Select(undefined);
        });
    }

    BindElemToEditor_(elem){
        if (elem.GetType() === EditorElementTypes.NewLine || elem.GetType() === EditorElementTypes.Tab)
            return;

        switch(elem.GetType()){
            case EditorElementTypes.InputBlock:
                this.SetInputBlock_OnInput_(elem);
                break;
            case EditorElementTypes.SelectionBlock:
                this.SetSelectionBlock_OnSelect_(elem);
                break;
            case EditorElementTypes.RepetitionGroup:
                this.SetRepetitionGroup_OnCreate(elem);
                this.SetRepetitionGroup_OnDragOver(elem);

                if (elem.GetLength() === 0){
                    ( new CreateRepetitiveElemCommand(this, elem) ).Execute(); // begin with 1 ready/created element
                }

                break;
            case EditorElementTypes.SimpleBlock:
                if (!elem.GetGeneratedBy()){
                    elem.SetDraggable(false);
                    elem.SetDroppable(false);
                }
                break;
        }
        
        this.SetElem_OnDrop(elem);
        this.SetElem_OnClick_(elem);
        this.SetElem_OnContextMenu_(elem);
        this.SetElem_Theme_(elem);
    }

    SetElem_Theme_(elem){
        elem.SetTheme((elem) => {
            if (elem.GetType() === EditorElementTypes.NewLine || elem.GetType() === EditorElementTypes.Tab){
                return {};
            }
            return this.theme["Blocks"]["Composite"][elem.GetSymbol().symbol.name];
        });
    }

    SetElem_OnClick_(elem){
        elem.SetOnClick((e, elem) => {
            this.$contextMenuContainer.empty();
            e.stopPropagation();
            this.Select(elem);
        });
    }

    SetElem_OnContextMenu_(elem){
        elem.SetOnContextMenu((e, elem) => {
            if (elem === this.code)
                return;

            e.preventDefault();
            e.stopPropagation();

            this.$contextMenuContainer.empty();

            this.Select(elem);

            let contextMenu = new ContextMenu(this.$contextMenuContainer, [
                [
                    {
                        name: 'Cut',
                        shortcut: 'Ctrl+X',
                        disabled: !this.CanCut(this.selected),
                        handler: () => this.EventHandler_Cut_()
                    },
                    {
                        name: 'Copy',
                        shortcut: 'Ctrl+C',
                        disabled: !this.CanCopy(this.selected),
                        handler: () => this.EventHandler_Copy_()
                    },
                    {
                        name: 'Paste',
                        shortcut: 'Ctrl+V',
                        disabled: !this.CanPaste(this.clipboard, this.selected),
                        handler: () => this.EventHandler_Paste_()
                    }
                ],
                [
                    {
                        name: 'Show Generation Path',
                        shortcut: 'Ctrl+G',
                        handler: () => {
                            this.generationPathPopup?.Destroy();
                            this.generationPathPopup = new GenerationPathPopup(this.$workspace, this.selected);
                            this.generationPathPopup.Render();
                        }
                    },
                ],
                [
                    {
                        name: 'Delete',
                        shortcut: 'Del',
                        disabled: !this.CanRemoveElem(this.selected),
                        handler: () => this.EventHandler_Delete_()
                    },
                    { 
                        name: 'Delete Until Possible',
                        shortcut: 'Alt+Del',
                        disabled: !this.CanRemoveElem(this.selected),
                        handler: () => this.EventHandler_DeleteUntilPossible_()
                    },
                ],
                [
                    { 
                        name: 'Indent',
                        shortcut: 'Tab',
                        handler: () => this.EventHandler_Indent_()
                    },
                    {
                        name: 'Outdent',
                        shortcut: 'Shift+Tab',
                        disabled: !this.CanOutdent(this.selected),
                        handler: () => this.EventHandler_Outdent_()
                    },
                    {
                        name: 'Place In New Line',
                        shortcut: 'Enter',
                        handler: () => this.EventHandler_NewLine_()
                    },
                ],
            ]);

            contextMenu.Render();

            this.FitContextMenu_(e);
        });
    }

    BindPlaceholderElem(elem) {
        if (elem.GetType() === EditorElementTypes.NewLine || elem.GetType() === EditorElementTypes.Tab)
            return;
                
        elem.SetDraggable(false);
        elem.SetDroppable(true);
        this.SetElem_Theme_(elem);
    }

    RemoveDropPlaceholder(){
        this.$dropPlaceholder?.remove();
        this.dropPlaceholderIndex = undefined;
    }

    FillDropPlaceholder(elem){
        let placeholderElem = EditorElementParser.FromString( 
            elem.ToString(),
            elem => this.BindPlaceholderElem(elem)
        );
        this.$dropPlaceholder.children('.content').empty();
        placeholderElem.Render(this.$dropPlaceholder.children('.content'));
    }

    FindPlaceholderPos(hoverElem, mouseY){
        assert(hoverElem.GetType() === EditorElementTypes.RepetitionGroup);

        let elems = hoverElem.GetElems();
        let start = 0, end = elems.length - 1, middle = Math.floor((end + start) / 2);
        let offset = mouseY - elems[middle].GetWholeView().offset().top - elems[middle].GetWholeView().height() / 2;

        while (end >= start){
            middle = Math.floor((end + start) / 2);
            offset = mouseY - elems[middle].GetWholeView().offset().top - elems[middle].GetWholeView().height() / 2;

            if (offset === 0)
                return middle;
            
            offset < 0 ? end = middle - 1 : start = middle + 1;
        }

        let pp = (offset <= 0) ? middle : middle + 1;

        if (
            pp != elems.length && pp >= 1 &&
            elems[pp].GetType() === EditorElementTypes.NewLine &&
            elems[pp-1].GetType() !== EditorElementTypes.NewLine
        ){
            ++pp;
        }

        return pp;
    }

    SetRepetitionGroup_OnDragOver(elem){
        let cachedDragElem;
        let canPaste;

        elem.SetOnDragOver((e, elem) => {
            if (cachedDragElem !== this.draggedElem){
                canPaste = this.CanPaste( this.draggedElem, elem.GetRepetitiveElem() );
                cachedDragElem = this.draggedElem;
            }

            if (!canPaste)  return;

            let mousePos = { x: e.pageX, y: e.pageY }, elems = elem.GetElems();
            let pp = this.FindPlaceholderPos(elem, mousePos.y);

            if (pp === this.dropPlaceholderIndex) return; // the placeholder is in the correct position already

            pp === elems.length ?
                this.$dropPlaceholder.insertAfter(elems[elems.length - 1].GetWholeView()) :
                this.$dropPlaceholder.insertBefore(elems[pp].GetWholeView());
                
            this.dropPlaceholderIndex = pp;
            this.dropTarget = elem;

            this.Select(undefined);
        });
    }

    SetElem_OnDrop(elem){

        elem.SetOnDragStart((e, elem) => {
            this.$contextMenuContainer.empty();
            this.draggedElem = elem;
            this.FillDropPlaceholder(this.draggedElem);
            this.HighlightValidPasteTargets(this.draggedElem);
        });

        elem.SetOnDragEnd((e, elem) => {
            this.RemoveDropPlaceholder();
            this.RemoveHighlights();
        });

        elem.SetOnDragEnter((e, elem) => {
            if (this.FindCommonPredecessor(this.draggedElem, elem)){
                this.dropTarget = elem;
                
                this.RemoveDropPlaceholder();
                this.Select(elem);
            }
        });

        elem.SetOnDrop((e, elem) => {
            if (elem !== this.dropTarget)
                return;

            e.stopPropagation();

            let b = EditorElementParser.FromString( this.draggedElem.ToString(), e => this.BindElemToEditor_(e) );
            
            if (this.dropPlaceholderIndex !== undefined && elem.GetType() === EditorElementTypes.RepetitionGroup)
                this.ExecuteCommand( new DropCommand(this, elem, b, this.dropPlaceholderIndex) );
            else if (this.CanPaste(b, elem))
                this.ExecuteCommand( new PasteCommand(this, b, elem) );
        
            this.RemoveHighlights();
            this.RemoveDropPlaceholder();
        });
    }

    SetSelectionBlock_OnSelect_(selectionBlock){
        selectionBlock.SetOnSelect((selectionBlock) => {
            this.ExecuteCommand(
                new ChooseCommand(
                    this, selectionBlock,
                    selectionBlock.GetSelectedSymbol()
                )
            );
        });
    }

    SetInputBlock_OnInput_(inputBlock){
        inputBlock.SetOnInput((inputBlock) => {
            let symbol = this.language.GetSymbol(
                inputBlock.GetSymbol().symbol.name, 
                inputBlock.GetSymbol().symbol.isTerminal
            );
            let type = this.language.GetTerminalType(symbol);
            let isValid = this.typeValidators[type];
            
            let $input = inputBlock.GetInput(), text = $input.val();
            text === '' || isValid(text) ? $input.removeClass('invalid-input') : $input.addClass('invalid-input');
        });
    }

    SetRepetitionGroup_OnCreate(repetitionGroup){
        repetitionGroup.SetOnCreate((repetitionGroup) =>
            this.ExecuteCommand(
                new CreateRepetitiveElemCommand(this, repetitionGroup)
            )
        );
    }

    PeekElemType(symbol){
        if (symbol.isTerminal){
        
            if (this.language.GetTerminalType(symbol) === Language.TerminalType.Static) return SimpleBlock;
            else return InputBlock;
        
        }else{
            let def = this.language.GetDefinition(symbol);

            switch (def.type) {
                case DefinitionRhs.Types.ALL_OFF:{
                    if (def.symbols.length === 1) return null; // the definition will be skipped for its rhs
                    else return Group;
                }
                case DefinitionRhs.Types.ANY_OF: {
                    if (def.symbols.length === 1) return null; // the definition will be skipped for its rhs
                    else return SelectionBlock;
                }
                case DefinitionRhs.Types.LIST_OF:{
                    return RepetitionGroup;
                }
                default:
                    assert(false, `Definition rhs with type of ${def.type}`);
            }
        }
    }

    CreateElem(rhsSymbol){
        let symbol = this.language.GetSymbol(
            rhsSymbol.symbol.name,
            rhsSymbol.symbol.isTerminal
        );

        let elem;

        if (symbol.isTerminal){

            if (this.language.GetTerminalType(symbol) === Language.TerminalType.Static){
                (rhsSymbol.textViewOnly) ? 
                    elem = new InvisibleBlock(rhsSymbol) : 
                    elem = new SimpleBlock(rhsSymbol);
            }else
                elem = new InputBlock(rhsSymbol);
            
        }else{
            let def = this.language.GetDefinition(symbol);

            switch (def.type) {
                case DefinitionRhs.Types.ALL_OFF:{
                    let elems = def.symbols.map( (rhsSymbol) => this.CreateElem(rhsSymbol) );
                    elem = (elems.length === 1) ? elems[0] : new Group(rhsSymbol, elems);
                    break;
                }
                case DefinitionRhs.Types.ANY_OF: {
                    (def.symbols.length === 1) ?
                        elem = this.CreateElem(def.symbols[0]) :
                        elem = new SelectionBlock(rhsSymbol, def.symbols);
                    break;
                }
                case DefinitionRhs.Types.LIST_OF:{
                    let elems = def.symbols.map( (rhsSymbol) => this.CreateElem(rhsSymbol) );
                    if (elems.length === 1){
                        elem = new RepetitionGroup(rhsSymbol, elems[0], []);
                    }
                    else{
                        let repElem = new Group(rhsSymbol, elems);
                        this.BindElemToEditor_(repElem);
                        elem = new RepetitionGroup(rhsSymbol, repElem, []);
                    }
                    break;
                }
                default:
                    assert(false, `Definition rhs with type of ${def.type}`);
            }
        }

        this.BindElemToEditor_(elem);
        return elem;
    }

    CreateNewLine(){
        let nl = new NewLine();
        return nl;
    }

    CreateTab(){
        let tab = new TabBlock();
        return tab;
    }

    CanCopy(elem){
        return elem && elem.GetSymbol;
    }

    CopyToClipboard(elem){
        if (!this.CanCopy(elem)) return false;
        this.clipboard = elem.CloneRec();
        return true;
    }

    HighlightValidPasteTargets(source){
        this.Select(undefined);

        this.code.ForEachRec((elem) => {
            if (this.FindCommonPredecessor(source, elem))
                elem.GetCustomizableView().addClass('highlighted');
        });
    }

    RemoveHighlights(){
        this.$code.find('.highlighted').removeClass('highlighted');
    }

    FindCommonPredecessor(elem1, elem2){
        if (!elem1?.GetSymbol || !elem2?.GetSymbol)
            return null;

        for (let iter1 = elem1; iter1; iter1 = iter1.GetGeneratedBy()){
            for (let iter2 = elem2; iter2; iter2 = iter2.GetGeneratedBy()){
                let symbol1 = iter1.GetSymbol().symbol, symbol2 = iter2.GetSymbol().symbol;
                if (symbol1.name === symbol2.name && symbol1.isTerminal === symbol2.isTerminal){
                    return { elem1: iter1, elem2: iter2 };
                }
            }
        }
        return null;
    }

    CanPaste(source, dest){
        return source !== dest && !!this.FindCommonPredecessor(source, dest);
    }

    NavigateIn() {
        let type = this.selected?.GetType();

        if ( type && (type === EditorElementTypes.Group || type === EditorElementTypes.RepetitionGroup) ){
            for (let i = 0; i < this.selected.GetLength(); ++i){
                let elem = this.selected.GetElem(i);
                if (
                    elem.GetType() != EditorElementTypes.NewLine &&
                    elem.GetType() != EditorElementTypes.Tab &&
                    elem.GetType() != EditorElementTypes.InvisibleBlock
                ){
                    this.Select(elem);
                    return true;
                }
            }
        }
        return false;
    }

    NavigateOut() {
        let parent = this.selected?.GetParent();
        if (parent){
            this.Select(parent);
            return true;
        }
        return false;
    }

    NavigateLeft() {
        if (this.selected && this.selected.GetParent()){
            let parent = this.selected.GetParent(), type = parent.GetType();
            assert(type === EditorElementTypes.Group || type === EditorElementTypes.RepetitionGroup);
            
            for (let i = parent.IndexOf(this.selected) - 1; i >= 0; --i){
                let elem = parent.GetElem(i);
                if (
                    elem.GetType() != EditorElementTypes.NewLine &&
                    elem.GetType() != EditorElementTypes.Tab &&
                    elem.GetType() != EditorElementTypes.InvisibleBlock    
                ){
                    this.Select(elem);
                    return true;
                }
            }
        }
        return false;
    }

    NavigateRight() {
        if (this.selected && this.selected.GetParent()){
            let parent = this.selected.GetParent(), type = parent.GetType();
            assert(type === EditorElementTypes.Group || type === EditorElementTypes.RepetitionGroup);

            for (let i = parent.IndexOf(this.selected) + 1; i < parent.GetLength(); ++i){
                let elem = parent.GetElem(i);
                if (
                    elem.GetType() != EditorElementTypes.NewLine && 
                    elem.GetType() != EditorElementTypes.Tab &&
                    elem.GetType() != EditorElementTypes.InvisibleBlock
                ){
                    this.Select(elem);
                    return true;
                }
            }
        }
        return false;
    }

    NavigateUp() {
        let parent = this.selected?.GetParent();
        if (parent){
            let type = parent.GetType();
            assert(type === EditorElementTypes.Group || type === EditorElementTypes.RepetitionGroup);

            for (var i = parent.IndexOf(this.selected); i > 0; --i){
                if ( parent.GetElem(i).GetType() === EditorElementTypes.NewLine )
                    break;
            }

            if (i > 0 && parent.GetElem(i).GetType() === EditorElementTypes.NewLine){
                for (i = i - 1; i >= 0; --i){
                    let elem = parent.GetElem(i);
                    if (
                        elem.GetType() != EditorElementTypes.NewLine &&
                        elem.GetType() != EditorElementTypes.Tab &&
                        elem.GetType() != EditorElementTypes.InvisibleBlock
                    ){
                        this.Select(elem);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    NavigateDown() {
        if (this.selected && this.selected.GetParent()){
            let parent = this.selected.GetParent(), type = parent.GetType();
            assert(type === EditorElementTypes.Group || type === EditorElementTypes.RepetitionGroup);
            
            for (var i = parent.IndexOf(this.selected); i < parent.GetLength() - 1; ++i){
                if ( parent.GetElem(i).GetType() === EditorElementTypes.NewLine ){
                    break;
                }
            }

            if (i < parent.GetLength() - 1 && parent.GetElem(i).GetType() === EditorElementTypes.NewLine){
                for (i = i + 1; i < parent.GetLength(); ++i){
                    let elem = parent.GetElem(i);
                    if (
                        elem.GetType() != EditorElementTypes.NewLine &&
                        elem.GetType() != EditorElementTypes.Tab &&
                        elem.GetType() != EditorElementTypes.InvisibleBlock
                    ){
                        this.Select(elem);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    ExecuteCommand(command){
        if (!this.undoToastMessageDisabled && !this.undoToastMessageVisible && this.undoToolbarVisible){
            this.AppendUndoToastMessage();
            return;
        }
        
        if (this.undoToastMessageDisabled && this.undoToolbarVisible)
            this.undoToolbar.Hide();

        if (!this.undoToastMessageVisible)
            this.commands.ExecuteAndAppend(command);
    }

    AppendUndoToastMessage(){
        this.undoToastMessageVisible = true;

        this.undoToastMessage = new ToastMessage({
            type: ToastMessage.Types.Information,
            title: 'Leaving Undo/Redo mode',
            explanation:    `To edit you have to leave Undo/Redo mode. After editting, redo won't be available for the actions that 
                            are currently on your redo history`,
            buttons: [
                {
                    name: 'Ok',
                    handler: (toastMessage) => {
                        this.undoToolbar.Hide();
                        this.undoToastMessageVisible = false;
                        toastMessage.Destroy()
                    }
                },
                {
                    name: 'Ok and don\'t show this again',
                    handler: (toastMessage) => { 
                        this.undoToolbar.Hide();
                        this.undoToastMessageVisible = false, this.undoToastMessageDisabled = true; 
                        toastMessage.Destroy();
                    }
                },
                {
                    name: 'Cancel',
                    handler: (toastMessage) => { this.undoToastMessageVisible = false, toastMessage.Destroy(); }
                }
            ]
        });

        this.undoToastMessage.SetOnClose( () => this.undoToastMessageVisible = false );

        this.AppendToastMessage(this.undoToastMessage);
    }

    UpdateUndoToolbar(){
        this.undoToolbar.SetUndoNumber(this.commands.GetUndoSize());
        this.undoToolbar.SetRedoNumber(this.commands.GetRedoSize());
        
        let undoCommand = this.commands.GetCurrentUndo();
        this.undoToolbar.SetUndoDescription( undoCommand ? `Undo "${undoCommand.description}"` : '-' );

        let redoCommand = this.commands.GetCurrentRedo();
        this.undoToolbar.SetRedoDescription( redoCommand ? `Redo "${redoCommand.description}"` : '-' );
    }
    
    AppendToastMessage(toastMessage, expirationTime, expirationCb){
        toastMessage.Render(this.$toastMessages);

        if (expirationTime)
            setTimeout( 
                () => {
                    expirationCb();
                    toastMessage.Destroy();
                },
                expirationTime 
            );
    }

    EventHandler_NavigateUp_(){
        this.NavigateUp();
    }

    EventHandler_NavigateDown_(){
        this.NavigateDown();
    }

    EventHandler_NavigateLeft_(){
        this.NavigateLeft();
    }

    EventHandler_NavigateRight_(){
        this.NavigateRight();
    }

    EventHandler_NavigateIn_(){
        this.NavigateIn();
    }

    EventHandler_NavigateOut_(){
        this.NavigateOut();
    }

    FindPreviousNewLine(group, startingIndex){
        for (let i = startingIndex - 1; i >= 0; --i){
            if ( group.GetElem(i).GetType() === EditorElementTypes.NewLine )
                return i;
        }
        return -1;
    }

    FindNextNewLine(group, startingIndex){
        for (let i = startingIndex; i < group.GetLength(); ++i){
            if ( group.GetElem(i).GetType() === EditorElementTypes.NewLine )
                return i;
        }
        return group.GetLength();
    }

    GetElemLine(elem){
        let parent = elem?.GetParent();

        if (
            parent?.GetType() === EditorElementTypes.RepetitionGroup || 
            parent?.GetType() === EditorElementTypes.Group
        ){
            let selectedIndex = parent.IndexOf(elem);

            let prevNewLine = this.FindPreviousNewLine(parent, selectedIndex);
            let nextNewLine = this.FindNextNewLine(parent, selectedIndex);

            let currLine = { 
                start: prevNewLine + 1,
                end: nextNewLine === parent.GetLength() ? nextNewLine - 1 : nextNewLine
            };
            currLine.elems =  parent.GetElems().slice(currLine.start, currLine.end + 1);
            
            return currLine;
        }

        return undefined;
    }

    CanReorderUp_(targetElem){
        let parent = targetElem?.GetParent();
        if (!parent || parent.GetType() !== EditorElementTypes.RepetitionGroup)
            return false;
        
        let currLine = this.GetElemLine(targetElem);

        if (currLine?.start === 0)    // there is no line above this one
            return false;
        
        return true;
    }

    ReorderContinuousLines(line1, line2){
        assert(line2.start === line1.end + 1);

        let parent = line1.elems[0].GetParent(), endl;

        if (parent.GetElem(line2.end).GetType() !== EditorElementTypes.NewLine)
            endl = line1.elems[line1.elems.length - 1];

        for (let i = 0; i < line1.elems.length; ++i){
            let elem = line1.elems[i];
            parent.RemoveElemAt(line1.start);
            parent.InsertAtIndex(line2.end, elem);
        }

        if (endl){
            assert(endl === parent.GetElem(parent.GetLength() - 1));
            parent.PopElem();
            parent.InsertAtIndex(line1.start + (line2.end - line2.start + 1), endl);
        }
    }

    EventHandler_ReorderUp_(){
        if (this.CanReorderUp_(this.selected))
            this.ExecuteCommand( new ReorderUpCommand(this, this.selected) );
    }

    CanReorderDown_(targetElem){
        let parent = targetElem?.GetParent();
        if (!parent || parent.GetType() !== EditorElementTypes.RepetitionGroup)
            return false;
        
        let currLine = this.GetElemLine(targetElem);

        if (currLine?.end === parent.GetLength() - 1)    // there is no line above this one
            return false;

        return true;
    }

    EventHandler_ReorderDown_(){
        if (this.CanReorderDown_(this.selected))
            this.ExecuteCommand( new ReorderDownCommand(this, this.selected) );
    }

    EventHandler_Delete_(){
        if (this.CanRemoveElem(this.selected)){
            this.ExecuteCommand( new DeleteCommand(this, this.selected) );
        }
    }

    EventHandler_DeleteUntilPossible_(){
        if (this.CanRemoveElem(this.selected)){
            this.ExecuteCommand( new DeleteUntilPossibleCommand(this, this.selected) );
        }
    }

    EventHandler_DeleteAll_(){
        this.ExecuteCommand( new DeleteAllCommand(this) );
    }

    EventHandler_Backspace_(){
        let prev = this.selected.GetParent().GetPreviousElem(this.selected);

        if (this.CanRemoveElem(prev)){
            this.ExecuteCommand( new DeleteCommand(this, prev) );
        }
    }

    EventHandler_Indent_(){
        if (this.selected && this.selected.GetParent()){
            this.ExecuteCommand( new IndentCommand(this, this.selected) );
        }
    }

    CanOutdent(elem){
        let previous = elem?.GetParent()?.GetPreviousElem(elem);
        return previous && previous.GetType() === EditorElementTypes.Tab;
    }

    EventHandler_Outdent_(){
        if (this.CanOutdent(this.selected)){
            this.ExecuteCommand( new OutdentCommand(this, this.selected) );
        }
    }

    EventHandler_NewLine_(){
        if (this.selected && this.selected.GetParent()){
            this.ExecuteCommand( new NewLineCommand(this, this.selected) );
        }
    }

    CanCut(elem){
        return this.CanCopy(elem) && this.CanRemoveElem(elem);
    }

    EventHandler_Cut_(){
        if (this.CanCut(this.selected)){
            this.CopyToClipboard(this.selected);
            this.ExecuteCommand( new DeleteUntilPossibleCommand(this, this.selected) );
        }
    }

    EventHandler_Copy_(){
        this.CopyToClipboard(this.selected);
    }

    EventHandler_Paste_(){
        let source = this.clipboard?.CloneRec(), dest = this.selected;
        if (this.CanPaste(source, dest)){
            this.ExecuteCommand( new PasteCommand(this, source, dest) );
        }
    }

    EventHandler_DownloadCode_(){
        DownloadAsFile(this.code.ToJsonRec(), 'CodeChips_VCode.json');
    }
    
    EventHandler_LoadCode_(files){
        if (files && files.length === 1){
            let reader = new FileReader();
            reader.addEventListener('load', e => {
                this.code = EditorElementParser.FromString(
                    e.target.result,
                    (elem) => {
                        if (elem.GetSymbol && elem.GetSymbol().symbol.name === 'program') // don't set the root's on drop, on click etc
                            this.BindRootElemToEditor_(elem);
                        else
                            this.BindElemToEditor_(elem);
                    }
                );
                this.Select(undefined);
                this.RenderWorkspace();
            });
            reader.readAsText(files[0]);
        }
    }

    EventHandler_Undo_(){
        if (this.commands.GetUndoSize()){
            this.undoToolbar.Show();
            this.commands.Undo();
            this.UpdateUndoToolbar();
        }
    }

    EventHandler_Redo_(){
        if (this.commands.GetRedoSize()){
            this.undoToolbar.Show();
            this.commands.Redo();
            this.UpdateUndoToolbar();
        }
    }

    EventHandler_ToggleViewMode(){
        this.viewMode === EditorElementViewMode.PureTextView ?
            this.viewMode = EditorElementViewMode.BlockView :
            this.viewMode = EditorElementViewMode.PureTextView;

        this.code.ForEachRec( elem => elem.ApplyViewMode(this.viewMode) );
    }
}