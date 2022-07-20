import { AliasedGrammarSymbol, DefinitionRhs, GrammarSymbol, Language} from '../language.js'
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
import { DownloadAsFile } from '../Utils/Download.js';
import { ToastMessage } from './EditorToastMessages/ToastMessage.js';
import { RepetitionGroup } from './EditorElements/RepetitionGroup.js';
import { CreateRepetitiveElemCommand } from './EditorCommands/CreateRepetitiveElemCommand.js';
import { ReorderUpCommand } from './EditorCommands/ReorderUpCommand.js';
import { ReorderDownCommand } from './EditorCommands/ReorderDownCommand.js';
import { DropCommand } from './EditorCommands/DropCommand.js';
import { ApplyCssToStyle, Theme, Themeable, ThemeableProps } from './Theme.js';
import { BeautifyCommand } from './EditorCommands/BeautifyCommand.js';
import { ReduceCommand } from './EditorCommands/ReduceCommand.js';
import { OptionalBlock } from './EditorElements/OptionalBlock.js';
import { AstHost } from '../Generators/AstHost.js';
import { ToJavascriptVisitor } from '../Generators/ToJavascriptVisitor.js';
import { EditorToolbar } from './EditorToolbar.js';
import { QuickReplaceCommand } from './EditorCommands/QuickReplaceCommand.js';


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
    
    undoToastMessageVisible = false;
    undoToastMessageDisabled = false;
    undoToastMessage;

    editorToolbar;

    static ViewMode = {
        BlockView:      EditorElementViewMode.BlockView,
        PureTextView:   EditorElementViewMode.PureTextView,
        JsView:         'JsView'
    }

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
        int : (text) => {
            return Number.isInteger(Number(text));
        },
        float: (text) => {
            return Number.isFinite(Number(text));
        },
        char: (text) => {
            return text.length === 1;
        },
        string: (text) => {
            return true;
        },
        bool: (text) => {
            return text === 'true' || text === 'false';
        },
        identifier: (text) => {
            let matched = /[_A-Za-z]+[_A-Za-z0-9]*/g.exec(text);
            return matched && matched[0] === text;
        }
    };

    commands = new CommandHistory();

    theme;
    autoPrettyPrint = true;

    // themeableIds, themeables, customizableViews for code

    static themeableIds = {
        SelectedBlock: 'Selected Block',
        CodeWorkspace: 'Code Workspace',
        Scrollbar: 'Scrollbar',
        ScrollbarThumb: 'Scrollbar Thumb',
        ScrollbarThumbOnHover: 'Scrollbar Thumb On Hover',
        ScrollbarTrack: 'Scrollbar Track',
    };

    static themeables = [
        {
            id: Editor.themeableIds.SelectedBlock,
            themeable: new Themeable(
                ThemeableProps.Props.BorderColor,
                ThemeableProps.Props.BorderShadow,
                ThemeableProps.Props.BorderWidth,
            ),
        },
        {
            id: Editor.themeableIds.CodeWorkspace,
            themeable: new Themeable(
                ThemeableProps.Props.BackgroundColor,
            ),
        },
        {
            id: Editor.themeableIds.Scrollbar,
            themeable: new Themeable(
                ThemeableProps.Props.Width,
                ThemeableProps.Props.Height,
            )
        },
        {
            id: Editor.themeableIds.ScrollbarThumb,
            themeable: new Themeable(
                ThemeableProps.Props.BackgroundColor,
                ThemeableProps.Props.BorderRadius
            )
        },
        {
            id: Editor.themeableIds.ScrollbarThumbOnHover,
            themeable: new Themeable(
                ThemeableProps.Props.BackgroundColor,
            ),
        },
        {
            id: Editor.themeableIds.ScrollbarTrack,
            themeable: new Themeable(
                ThemeableProps.Props.BackgroundColor,
                ThemeableProps.Props.BorderWidth,
                ThemeableProps.Props.BorderColor,
            ),
        },
    ];

    customizableViews = [
        {
            id: Editor.themeableIds.SelectedBlock,
            ApplyTheme: (theme) => {
                ApplyCssToStyle(
                    `${this.id}-selected-block`,
                    [`#${this.id} .code .selected`],
                    [theme.ToCss()]
                )
            }
        },
        {
            id: Editor.themeableIds.CodeWorkspace,
            GetView: () => { return this.$code; }
        },
        {
            id: Editor.themeableIds.Scrollbar,
            ApplyTheme: (theme) => {
                ApplyCssToStyle(
                    `${this.id}-scrollbar-style`,
                    [`#${this.id} .code::-webkit-scrollbar`],
                    [theme.ToCss()]
                )
            }
        },
        {
            id: Editor.themeableIds.ScrollbarThumb,
            ApplyTheme: (theme) => {
                ApplyCssToStyle(
                    `${this.id}-scrollbar-thumb-style`,
                    [`#${this.id} .code::-webkit-scrollbar-thumb`],
                    [theme.ToCss()]
                )
            }
        },
        {
            id: Editor.themeableIds.ScrollbarThumbOnHover,
            ApplyTheme: (theme) => {
                ApplyCssToStyle(
                    `${this.id}-scrollbar-thumb-hover-style`,
                    [`#${this.id} .code::-webkit-scrollbar-thumb:hover`],
                    [theme.ToCss()]
                )
            }
        },
        {
            id: Editor.themeableIds.ScrollbarTrack,
            ApplyTheme: (theme) => {
                ApplyCssToStyle(
                    `${this.id}-scrollbar-track-style`,
                    [`#${this.id} .code::-webkit-scrollbar-track`],
                    [theme.ToCss()]
                )
            }
        },
    ];

    static currId = 0;
    id;

    onConvertToJs;
    onExecute;

    constructor($container, language, toolboxInfo, themeJson){
        this.id = 'editor' + Editor.currId++;

        this.$container = $container;
        this.language = language;
        
        this.SetTheme(themeJson);

        this.InitializeCode_();
        this.InitializeView_();
        this.InitializeEvents_();
        this.SetUpContextMenu_();

        this.SetUpToolbox_(toolboxInfo);
        this.SetWorkspace_DragAndDrop();
        this.SetUpEditorToolbar_();

        this.Render();
        this.ApplyTheme();
        console.log( this.CreateThemeStructure() );

        this.productionPaths = this.language.ComputeReachabilityMatrix();
        console.log(this.productionPaths);
    }

    IsCorrectTheme(theme){
        //todo
        return true;
    }

    CreateGeneralBlockThemeStructure(){
        let blockThemes = {};

        let blockClasses = [ Group, RepetitionGroup, SimpleBlock, InputBlock, SelectionBlock, OptionalBlock ];
        
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
            let blockClass = this.PeekElemType(symbol);

            if (!blockClass)
                continue;

            blockThemes[symbol.name] = {};

            for (let themable of blockClass.themeables){
                blockThemes[symbol.name][themable.id] = {};

                for (let prop of themable.themeable.props){
                    blockThemes[symbol.name][themable.id][prop] = '';
                }
            }
        }

        return blockThemes;
    }

    CreatePrettyPrintThemeStructure(forBlockView){
        let prettyPrint = {};

        for (let symbol of this.language.GetNonTerminals()){
            let blockClass = this.PeekElemType(symbol);

            if (blockClass === Group){
                let children = this.language.GetDefinition(symbol).symbols;

                children = children.map(sym => sym.alias || sym.symbol.name);
                
                prettyPrint[symbol.name] = children;
            }
            else if (blockClass === RepetitionGroup){
                forBlockView ?
                    prettyPrint[symbol.name] = { 'NewLine Between Blocks': 'auto' }:
                    prettyPrint[symbol.name] = {
                        'Insert When Empty': [],
                        'Insert Before First Block': [],
                        'Insert Between Blocks': [],
                        'Insert After Last Block': [],
                    };
            }
        }

        return prettyPrint;
    }

    CreateSourceTextThemeStructure(){
        let blockThemes = {};

        for (let symbol of [...this.language.GetTerminals(), ...this.language.GetNonTerminals()]){
            let blockClass = this.PeekElemType(symbol);

            if ( blockClass === SelectionBlock || blockClass === InputBlock || blockClass === SimpleBlock ){
                blockThemes[symbol.name] = '';
            }
        }

        return blockThemes;
    }

    CreateCodeThemeStructure(){
        let codeTheme = {};

        for (let themable of Editor.themeables){
            codeTheme[themable.id] = {};

            for (let prop of themable.themeable.props)
                codeTheme[themable.id][prop] = '';
        }

        return codeTheme;
    }

    CreateThemeStructure(){
        let themes = {
            'Blocks': {
                'General': this.CreateGeneralBlockThemeStructure(),
                'Specific': this.CreateSpecificBlockThemeStructure()
            },
            'Code Workspace': this.CreateCodeThemeStructure(),
            'Toolbox': this.toolbox.CreateThemeStructure(),
            'Context Menu': ContextMenu.CreateThemeStructure(),
            'Source Text View Colors': this.CreateSourceTextThemeStructure(),
            'Pretty Print': this.CreatePrettyPrintThemeStructure(true),
            'Source Text Pretty Print': this.CreatePrettyPrintThemeStructure(false),
        };

        return themes;
    }

    ApplyTheme() {
        this.ApplyCodeWorkspaceTheme(this.theme['Code Workspace']);
        this.toolbox.ApplyTheme(this.theme['Toolbox']);

        this.code.ForEachRec(elem => {
            elem.ApplyViewMode(this.viewMode);
        });

        this.toolbox.SetElem_Theme((elem) => {
            if (elem.GetType() === EditorElementTypes.NewLine || elem.GetType() === EditorElementTypes.Tab){
                return {};
            }
            return this.theme["Blocks"]["Composite"][elem.GetSymbol().symbol.name];
        });
    }

    ApplyCodeWorkspaceTheme(themes){
        this.customizableViews.forEach((view) => {
            let theme = themes[view.id];
            if (!theme) return;
            
            (view.ApplyTheme) ? view.ApplyTheme(theme): view.GetView().css(theme.ToCss());
        });
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
                    if (specific && specific[themeable.id][prop] !== '' && specific[themeable.id][prop] !== undefined)
                        composite[themeable.id][prop] = specific[themeable.id][prop];
                    else if (general[themeable.id][prop] !== '' && general[themeable.id][prop] !== undefined)
                        composite[themeable.id][prop] = general[themeable.id][prop];
                }

                composite[themeable.id] = new Theme(composite[themeable.id]);
            }
        }
    }

    SetTheme(theme){
        if (!this.IsCorrectTheme(theme)) return false;

        theme = JSON.parse(JSON.stringify(theme));

        this.CalculateCompositeBlockTheme(theme);

        for (let component of ['Code Workspace', 'Toolbox', 'Undo Redo Toolbar', 'Context Menu']){
            for (let themePart in theme[component])
                theme[component][themePart] = new Theme(theme[component][themePart]);
        }

        
        theme["Toolbox"]["Blocks"] = theme["Blocks"];

        for (let symbol in theme['Source Text View Colors']){
            let colorOnlyTheme = {};
            colorOnlyTheme[ThemeableProps.Props.FontColor] = theme['Source Text View Colors'][symbol];
            colorOnlyTheme = new Theme(colorOnlyTheme);

            theme['Source Text View Colors'][symbol] = colorOnlyTheme;
        }

        this.theme = theme;

        return true;
    }

    quickReplace = {};

    SetQuickReplace(quickReplace){
        for (let interchangableSymbols of quickReplace){
            for (let symbolName in interchangableSymbols){
                let configDef = interchangableSymbols[symbolName];
                let langDef = this.language.GetDefinition(symbolName);

                if (langDef.symbols.length !== configDef.length){
                    assert(false, `Wrong Quick Replace definition for ${symbolName}`);
                    delete interchangableSymbols.symbolName;
                }
            }

            for (let symbolName1 in interchangableSymbols){
                if (!this.quickReplace[symbolName1])
                    this.quickReplace[symbolName1] = {};

                for (let symbolName2 in interchangableSymbols){
                    if (symbolName1 !== symbolName2){
                        this.quickReplace[symbolName1][symbolName2] =   [ 
                            interchangableSymbols[symbolName1],
                            interchangableSymbols[symbolName2]
                        ];
                    }
                }
            }
        }
    }

    InitializeCode_(){
        let startingSymbol = new AliasedGrammarSymbol(this.language.GetSymbol('program', false));
        this.code = this.CreateElem(startingSymbol);
        this.BindRootElemToEditor_(this.code);
    }

    InitializeView_(){
        this.$workspace = $('<div/>').addClass('workspace');

        this.$code = $('<div/>').addClass('code');
        this.$jsCode = $('<textarea readonly>').addClass('js-code');
        this.$contextMenuContainer = $('<div/>').addClass('editor-context-menu-container');
        this.$toastMessages = $('<div/>').addClass('editor-toast-messages');
        this.$workspaceAndToolbox = $('<div/>').addClass('workspace-and-toolbox');
        this.$editorToolbarContainer = $('<div/>').addClass('editor-toolbar-container');

        this.$editorToolbarContainer.click((e) => {
            e.stopPropagation();

            this.$contextMenuContainer.empty();
        });

        this.$workspace.append(
            this.$code,
            this.$jsCode,
            this.$toastMessages,
            this.$contextMenuContainer
        );
        this.$workspace.on('click', ()=> this.Select(undefined) );

        this.$toolboxspace = $('<div/>').addClass('toolboxspace');
        
        this.$workspaceAndToolbox.append(this.$toolboxspace, this.$workspace);

        this.$editor = $('<div/>').addClass('editor').attr('id', this.id);
        this.$editor.append(this.$editorToolbarContainer, this.$workspaceAndToolbox);
        
        this.$editor.on('click', () => {
            this.$contextMenuContainer.empty();
            this.editorToolbar.CloseCurrentContextMenu();
        });

        this.$container.empty();
        this.$container.append(this.$editor);
    }

    InitializeEvents_(){
        const Keys = KeyboardEventManager.Keys;
        
        let EvHandler = (f) => {
            return (e) => {
                if (this.viewMode !== EditorElementViewMode.BlockView) return;

                e.preventDefault();
                e.stopPropagation();

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
            .AddEventHandler( [Keys.CTRL, Keys.B],                  EvHandler(() => this.EventHandler_Beautify()) )
            .AddEventHandler( [Keys.CTRL, Keys.Q],                  EvHandler(() => this.EventHandler_Execute()) )
        ;
    }

    SetUpEditorToolbar_(){
        this.editorToolbar = new EditorToolbar(this.$editorToolbarContainer);

        this.editorToolbar.AddContextMenu('File', [
            [
                {
                    name:       'Import Visual Code',
                    shortcut:   'Ctrl+L',
                    disabled:   () => this.viewMode !== EditorElementViewMode.BlockView,
                    needsFile:  true,
                    handler:    (files) => this.EventHandler_LoadCode_(files)
                },
                {
                    name:       'Download Visual Code',
                    shortcut:   'Ctrl+S',
                    disabled:   () => this.viewMode !== EditorElementViewMode.BlockView,
                    handler:    () => this.EventHandler_DownloadCode_()
                }
            ],
        ]);
        this.editorToolbar.AddContextMenu('Edit', [
            [
                {
                    name:       'Undo',
                    shortcut:   'Ctrl+Z',
                    disabled:   () => this.viewMode !== EditorElementViewMode.BlockView || !this.commands.GetUndoSize(),
                    handler:    () => this.EventHandler_Undo_()
                },
                {
                    name:       'Redo',
                    shortcut:   'Ctrl+Y',
                    disabled:   () => this.viewMode !== EditorElementViewMode.BlockView || !this.commands.GetRedoSize(),
                    handler:    () => this.EventHandler_Redo_()
                },
            ],
            [
                {
                    name:       'Cut',
                    shortcut:   'Ctrl+X',
                    disabled:   () => !this.CanCut(this.selected),
                    handler:    () => this.EventHandler_Cut_()
                },
                {
                    name:       'Copy',
                    shortcut:   'Ctrl+C',
                    disabled:   () => !this.CanCopy(this.selected),
                    handler:    () => this.EventHandler_Copy_()
                },
                {
                    name:       'Paste',
                    shortcut:   'Ctrl+V',
                    disabled:   () => !this.CanPaste(this.clipboard, this.selected),
                    handler:    () => this.EventHandler_Paste_()
                }
            ],
            [
                {
                    name:       'Beautify',
                    shortcut:   'Ctrl+B',
                    disabled:   () => this.viewMode !== EditorElementViewMode.BlockView,
                    handler:    () => this.EventHandler_Beautify()
                }
            ],
            [
                {
                    name:       'Show Productions',
                    shortcut:   'Ctrl+G',
                    disabled:   () => !this.selected,
                    handler:    () => {
                                    this.EventHandler_ShowGenerationPath();
                                }
                },
            ],
            [
                { 
                    name:       'Indent',
                    shortcut:   'Tab',
                    disabled:   () => !this.selected,
                    handler:    () => this.EventHandler_Indent_()
                },
                {
                    name:       'Outdent',
                    shortcut:   () => 'Shift+Tab',
                    disabled:   () => !this.CanOutdent(this.selected),
                    handler:    () => this.EventHandler_Outdent_()
                },
                {
                    name:       'Place In New Line',
                    shortcut:   'Enter',
                    disabled:   () => !this.selected,
                    handler:    () => this.EventHandler_NewLine_()
                },
            ],
            [
                {
                    name:       'Delete',
                    shortcut:   'Del',
                    disabled:   () => !this.CanRemoveElem(this.selected),
                    handler:    () => this.EventHandler_Delete_()
                },
                { 
                    name:       'Delete Until Possible',
                    shortcut:   'Alt+Del',
                    disabled:   () => !this.CanRemoveElem(this.selected),
                    handler:    () => this.EventHandler_DeleteUntilPossible_()
                },
                {
                    name:       'Reduce To',
                    disabled:   () => !this.CanReduceElem(this.selected),
                    options:    () => {
                                    if (this.CanReduceElem(this.selected)){
                                        return  [
                                            this.GetGeneratedBys(this.selected).map(generatedBy => {
                                                return {
                                                    name: generatedBy.GetSymbol().alias || generatedBy.GetSymbol().symbol.name,
                                                    disabled: false,
                                                    handler: () => this.ExecuteCommand( new ReduceCommand(this, this.selected, generatedBy) )
                                                };
                                            })
                                        ];
                                    }
                                }
                },
                {
                    name:       'Delete All',
                    shortcut:   'Ctrl+A+Del',
                    disabled:   () => this.viewMode !== EditorElementViewMode.BlockView,
                    handler:    () => this.EventHandler_DeleteAll_()
                }
            ],
        ]);
        
        this.editorToolbar.AddButtonCategory([
            {
                class:      'editor-toolbar-undo-button',
                handler:    () => {
                    this.EventHandler_Undo_();
                },
                tooltip:    'Undo'
            },
            {
                class:      'editor-toolbar-redo-button',
                handler:    () => {
                    this.EventHandler_Redo_();
                },
                tooltip:    'Redo'
            },
        ]);

        this.editorToolbar.AddButtonCategory(
            [
                {
                    class:      'editor-toolbar-blocks-button',
                    handler:    () => {
                        this.EventHandler_EnterBlockView();

                        if (this.commands.GetUndoSize())    this.editorToolbar.EnableButton('editor-toolbar-undo-button');
                        if (this.commands.GetRedoSize())    this.editorToolbar.EnableButton('editor-toolbar-redo-button');
                    
                        if (this.onExecute) this.editorToolbar.EnableButton('editor-toolbar-play-button');
                    },
                    tooltip:    'Visual Programming',
                    selected:   true,
                },
                {
                    class:      'editor-toolbar-source-code-button',
                    handler:    () => {
                        this.EventHandler_EnterSourceCodeView();

                        this.editorToolbar.DisableButton('editor-toolbar-undo-button');
                        this.editorToolbar.DisableButton('editor-toolbar-redo-button');
                        this.editorToolbar.DisableButton('editor-toolbar-play-button');                    
                    },
                    tooltip:    'See the source code'
                },
                {
                    class:      'editor-toolbar-js-button',
                    handler:    () => {
                        this.EventHandler_Enter_JavascriptView();

                        this.editorToolbar.DisableButton('editor-toolbar-undo-button');
                        this.editorToolbar.DisableButton('editor-toolbar-redo-button');
                    
                        if (this.onExecute) this.editorToolbar.EnableButton('editor-toolbar-play-button');
                    },
                    tooltip:    'See the JavasSript corresponding to the visual code'
                },
            ],
            true
        );

        this.editorToolbar.AddButtonCategory([
            {
                class:      'editor-toolbar-play-button',
                handler:    () => {
                    this.EventHandler_Execute();
                },
                tooltip:    'Run'
            },
        ]);

        this.editorToolbar.DisableButton('editor-toolbar-undo-button');
        this.editorToolbar.DisableButton('editor-toolbar-redo-button');
    }

    SetUpToolbox_(toolboxInfo){
        this.toolbox = new Toolbox(this.$toolboxspace, toolboxInfo);
        this.toolbox.SetToolbox_MaxWidth(() => {
            return 0.8 * this.$container.width();
        });
        this.toolbox.SetToolbox_MinWidth(() => {
            return 0.2 * this.$container.width();
        });

        this.toolbox.RenderAllBlocks();
    }

    SetUpContextMenu_(){
        this.$workspace.on('contextmenu', (e) => {
            if (this.viewMode === Editor.ViewMode.JsView) return;

            e.preventDefault();
            this.Select(undefined);
            
            this.$contextMenuContainer.empty();
            this.editorToolbar.CloseCurrentContextMenu();

            let contextMenu = new ContextMenu(this.$contextMenuContainer, [
                [
                    {
                        name: 'Undo',
                        shortcut: 'Ctrl+Z',
                        disabled: this.viewMode !== EditorElementViewMode.BlockView || !this.commands.GetUndoSize(),
                        handler: () => this.EventHandler_Undo_()
                    },
                    {
                        name: 'Redo',
                        shortcut: 'Ctrl+Y',
                        disabled: this.viewMode !== EditorElementViewMode.BlockView || !this.commands.GetRedoSize(),
                        handler: () => this.EventHandler_Redo_()
                    },
                ],
                [
                    {
                        name: 'Import Visual Code',
                        shortcut: 'Ctrl+L',
                        disabled: this.viewMode !== EditorElementViewMode.BlockView,
                        needsFile: true,
                        handler: (files) => this.EventHandler_LoadCode_(files)
                    },
                    {
                        name: 'Download Visual Code',
                        shortcut: 'Ctrl+S',
                        disabled: this.viewMode !== EditorElementViewMode.BlockView,
                        handler: () => this.EventHandler_DownloadCode_()
                    }
                ],
                [
                    {
                        name: 'Beautify',
                        shortcut: 'Ctrl+B',
                        disabled: this.viewMode !== EditorElementViewMode.BlockView,
                        handler: () => this.EventHandler_Beautify()
                    }
                ],
                [
                    {
                        name: 'Delete All',
                        shortcut: 'Ctrl+A+Del',
                        disabled: this.viewMode !== EditorElementViewMode.BlockView,
                        handler: () => this.EventHandler_DeleteAll_()
                    }
                ],
            ]);

            contextMenu.Render();
            contextMenu.ApplyTheme(this.theme['Context Menu']);

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

        if (generatedBy)
            parent.InsertAfterElem(elem, generatedBy);

        if (elem === this.selected){
            if (generatedBy)
                this.Select(generatedBy);
            else
                this.NavigateLeft() || this.NavigateOut() || (this.selected = undefined);
        }

        parent.RemoveElem(elem);

        return true;
    }

    CanReduceElem(elem) {
        return !!(elem?.GetGeneratedBy());
    }

    GetGeneratedBys(elem){
        let generatedBys = [];
        
        for (let i = elem.GetGeneratedBy(); i; i = i.GetGeneratedBy())
            generatedBys.push(i);
        
        return generatedBys;
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
            this.editorToolbar.CloseCurrentContextMenu();

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
            this.editorToolbar.CloseCurrentContextMenu();
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
                
                if (this.autoPrettyPrint){
                    elem.SetButtonPlacement(
                        this.theme['Pretty Print'][elem.GetSymbol().symbol.name] ?
                            this.theme['Pretty Print'][elem.GetSymbol().symbol.name]['NewLine Between Blocks']: 
                            'auto'
                    );
                }

                break;
            case EditorElementTypes.SimpleBlock:
                if (!elem.GetGeneratedBy()){
                    elem.SetDraggable(false);
                    elem.SetDroppable(false);
                }
                break;
            case EditorElementTypes.OptionalBlock:
                elem.SetDraggable(false);
                elem.SetDroppable(false);
                break;
        }
        
        this.SetElem_OnDrop(elem);
        this.SetElem_OnClick_(elem);
        this.SetElem_OnContextMenu_(elem);
        this.SetElem_Theme_(elem);
        this.SetElem_TextViewTheme_(elem);
    }

    ApplyPrettyPrint(elem, prettyPrintTheme, viewMode){
        
        if (elem.GetType() !== EditorElementTypes.Group && elem.GetType() !== EditorElementTypes.RepetitionGroup)
            return;

        let pp = prettyPrintTheme[elem.GetSymbol().symbol.name];

        if (!pp) return;

        let toBlock = (id) => {
            if (id === '$$_newline')
                return this.CreateNewLine();
            else if (id === '$$_tab')
                return this.CreateTab();
            else {
                let sb = new SimpleBlock( new AliasedGrammarSymbol(new GrammarSymbol(id.substring(3), true)) );
                this.BindElemToEditor_(sb);
                return sb;
            }
        };

        if (elem.GetType() === EditorElementTypes.Group){
            let children = elem.GetElems();

            if (viewMode === EditorElementViewMode.PureTextView){
                children = children.filter(elem =>
                    elem.GetType() !== EditorElementTypes.NewLine &&
                    elem.GetType() !== EditorElementTypes.Tab
                );
            }else
                children = [...children];
            
            let indentationChars = [], indentationCharsTotal = [];

            for (let i = 0; i < pp.length; ++i){
                if (pp[i].length >= 3 && pp[i].substring(0, 3) === '$$_'){
                    indentationChars.push( toBlock(pp[i]) );
                }
                else if (indentationChars.length){
                    let startingIndex = elem.IndexOf(children[i - indentationCharsTotal.length - indentationChars.length]);
                    
                    for (let j = 0; j < indentationChars.length; ++j){
                        let indentationChar = indentationChars[j], index = startingIndex + j;

                        elem.InsertAtIndex(index, indentationChar);
                        indentationCharsTotal.push({ index, indentationChar });
                    }
                    
                    indentationChars = [];
                }
            }

            for (let j = 0; j < indentationChars.length; ++j){
                let indentationChar = indentationChars[j], index = elem.GetLength();

                elem.PushElem(indentationChar);
                indentationCharsTotal.push({ index, indentationChar });
            }

            return indentationCharsTotal;
        }
        else if (elem.GetType() === EditorElementTypes.RepetitionGroup){
            let inbetween = [];

            if (viewMode === EditorElementViewMode.PureTextView){
                inbetween = pp['Insert Between Blocks'] || [];
            }else{
                let nl = pp['NewLine Between Blocks'] || 'auto';
            
                if (nl === true || nl === false)    elem.SetButtonPlacement(nl);
                else                                elem.SetButtonPlacement('auto');

                if ( nl === true || (nl === 'auto' ||nl === undefined || nl === null) &&
                                    (
                                        elem.GetRepetitiveElem().GetType() === EditorElementTypes.SelectionBlock ||
                                        elem.GetRepetitiveElem().GetType() === EditorElementTypes.Group ||
                                        elem.GetRepetitiveElem().GetType() === EditorElementTypes.RepetitionGroup
                                    )
                ){
                    inbetween.push('$$_newline');
                }
            }

            let indentationCharsTotal = [];

            if (inbetween.length){
                for (let i = 1; i < elem.GetLength(); ++i){
                    let childType = elem.GetElem(i).GetType();

                    if (childType !== EditorElementTypes.Tab && childType !== EditorElementTypes.NewLine){
                        for (let char of inbetween){
                            let indentationChar = toBlock(char);
                            elem.InsertAtIndex(i, indentationChar);
                            indentationCharsTotal.push({ indentationChar, index: i });
                            
                            ++i;
                        }
                    }
                }
            }

            if (viewMode === EditorElementViewMode.PureTextView){
                if (elem.GetLength()){
                    
                    let beforeFirst = pp['Insert Before First Block'] || [];

                    for(let char of beforeFirst)
                        indentationCharsTotal.unshift( toBlock(char) );
                    
                    let afterLast = pp['Insert After Last Block'] || [];

                    for(let char of afterLast)
                        indentationCharsTotal.push( toBlock(char) );
                    
                }else{
                    let whenEmpty = pp['Insert When Empty'] || [];
                    
                    for (let char of whenEmpty)
                        indentationCharsTotal.push( toBlock(char) );
                }
            }

            return indentationCharsTotal;
        }
    }

    SetElem_Theme_(elem){
        elem.SetTheme((elem) => {
            if (elem.GetType() === EditorElementTypes.NewLine || elem.GetType() === EditorElementTypes.Tab){
                return {};
            }
            return this.theme["Blocks"]["Composite"][elem.GetSymbol().symbol.name];
        });
    }

    SetElem_TextViewTheme_(elem){
        elem.SetTextViewTheme((elem) => {
            if (elem.GetType() === EditorElementTypes.NewLine || elem.GetType() === EditorElementTypes.Tab){
                return;
            }

            return this.theme["Source Text View Colors"][elem.GetSymbol().symbol.name];
        });
    }

    SetElem_OnClick_(elem){
        elem.SetOnClick((e, elem) => {
            this.$contextMenuContainer.empty();
            this.editorToolbar.CloseCurrentContextMenu();
            e.stopPropagation();
            
            if (elem.GetType() === EditorElementTypes.OptionalBlock){
                this.ExecuteCommand(
                    new ChooseCommand(
                        this, elem,
                        elem.GetNewSymbol()
                    )
                );
            }else
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
            this.editorToolbar.CloseCurrentContextMenu();

            this.Select(elem);

            let category1 = [
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
            ];

            let category2 = [
                {
                    name: 'Show Productions',
                    shortcut: 'Ctrl+G',
                    disabled: !this.selected,
                    handler: () => {
                        this.EventHandler_ShowGenerationPath();
                    }
                },
            ]

            let category3 = [
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
                {
                    name: 'Reduce To',
                    disabled: !this.CanReduceElem(this.selected),
                    options: [
                        this.GetGeneratedBys(elem)
                            .map(generatedBy => {
                                return {
                                    name: generatedBy.GetSymbol().alias || generatedBy.GetSymbol().symbol.name,
                                    disabled: false,
                                    handler: () => this.ExecuteCommand( new ReduceCommand(this, elem, generatedBy) )
                                };
                            })
                    ]
                },
            ];


            let quickReplaceOptions = this.GetValidQuickReplacements(elem);

            category3.push(
                {
                    name: 'Quick Replace With',
                    disabled: !quickReplaceOptions.length,
                    options: [
                        quickReplaceOptions.map(symbolName => {
                            return {
                                name: symbolName,
                                disabled: false,
                                handler: () => this.ExecuteCommand(
                                    new QuickReplaceCommand(
                                        this,
                                        elem,
                                        this.CreateElem(
                                            this.productionPaths
                                                [(this.GetGeneratedBys(elem).pop() || elem).GetSymbol().symbol.name]
                                                [symbolName]
                                            .at(-1)
                                            .Clone()
                                        )
                                    )
                                )
                            }
                        })
                    ]
                }
            );

            let category4 = [
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
            ];

            let options = [ category1, category2, category3, category4 ];
            let contextMenu = new ContextMenu(this.$contextMenuContainer, options);

            contextMenu.Render();
            contextMenu.ApplyTheme(this.theme['Context Menu']);

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

        if (elems.length === 0)
            return 0;

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

            if (pp === 0 && elems.length === 0){
                elem.GetWholeView().prepend(this.$dropPlaceholder);
            } else {
                pp === elems.length ?
                    this.$dropPlaceholder.insertAfter(elems[elems.length - 1].GetWholeView()) :
                    this.$dropPlaceholder.insertBefore(elems[pp].GetWholeView());
            }
                
            this.dropPlaceholderIndex = pp;
            this.dropTarget = elem;

            this.Select(undefined);
        });
    }

    SetElem_OnDrop(elem){

        elem.SetOnDragStart((e, elem) => {
            this.$contextMenuContainer.empty();
            this.editorToolbar.CloseCurrentContextMenu();
            
            this.draggedElem = elem;
            this.FillDropPlaceholder(this.draggedElem);
            this.HighlightValidPasteTargets(this.draggedElem);
        });

        elem.SetOnDragEnd((e, elem) => {
            this.RemoveDropPlaceholder();
            this.RemoveHighlights();
        });

        elem.SetOnDragEnter((e, elem) => {
            if (this.CanPaste(this.draggedElem, elem)){
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
            
            assert(def, `missing definition for symbol ${symbol.name}`);

            switch (def.type) {
                case DefinitionRhs.Types.ALL_OFF:{
                    if (def.symbols.length === 1) return null; // the definition will be skipped for its rhs
                    else return Group;
                }
                case DefinitionRhs.Types.ANY_OF: {
                    if (def.symbols.length === 1) return null; // the definition will be skipped for its rhs
                    else return SelectionBlock;
                }
                case DefinitionRhs.Types.OPTIONAL:{
                    return OptionalBlock;
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
                elem = new SimpleBlock(rhsSymbol);
            }else
                elem = new InputBlock(rhsSymbol);
            
        }else{
            let def = this.language.GetDefinition(symbol);

            switch (def.type) {
                case DefinitionRhs.Types.ALL_OFF:{
                    let elems = def.symbols.map( (rhsSymbol) => this.CreateElem(rhsSymbol) );
                    if (elems.length === 1) return elems[0];
                    elem = new Group(rhsSymbol, elems);
                    break;
                }
                case DefinitionRhs.Types.ANY_OF: {
                    if (def.symbols.length === 1) return this.CreateElem(def.symbols[0]);
                    elem = new SelectionBlock(rhsSymbol, def.symbols);
                    break;
                }
                case DefinitionRhs.Types.OPTIONAL:{
                    elem = new OptionalBlock(rhsSymbol, def.symbols[0]);
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

        if (this.autoPrettyPrint)
            this.ApplyPrettyPrint(elem, this.theme['Pretty Print'], EditorElementViewMode.BlockView);
        
        this.BindElemToEditor_(elem);
        return elem;
    }

    CreateElemSequence(path){
        let elem;

        for (let i = 0; i < path.length; ++i){
            let rhsSymbol = path[i];

            if (!this.PeekElemType(rhsSymbol.symbol)) // the symbol does not exist as a block
                continue;

            let next = this.CreateElem(rhsSymbol);
            
            next.SetGeneratedBy( elem );
            if (elem)
                elem.SetSelectedSymbol(
                    elem.GetAlternateSymbols().findIndex(sym=> rhsSymbol.symbol.name === sym.symbol.name)
                );

            elem = next;
        }

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
            if (this.CanPaste(source, elem))
                elem.GetCustomizableView().addClass('highlighted');
        });
    }

    RemoveHighlights(){
        this.$code.find('.highlighted').removeClass('highlighted');
    }

    CanPaste(source, dest){
        if (!source || !dest || source === dest)
            return false;

        if (!source?.GetSymbol || !dest?.GetSymbol)
            return false;

        let destRoot = this.GetGeneratedBys(dest).pop() || dest;

        return !!this.productionPaths[destRoot.GetSymbol().symbol.name][source.GetSymbol().symbol.name];
    }

    GetValidQuickReplacements(elem){
        let options = Object.keys(this.quickReplace[elem.GetSymbol().symbol.name] || {});
        
        return options.filter((option) => this.CanQuickReplace(elem, option));
    }

    CanQuickReplace(elem, replacementName){
        let from = (this.GetGeneratedBys(elem).pop() || elem).GetSymbol().symbol.name;
        let path = this.productionPaths[from][replacementName];
        
        return !!path;
    }

    NavigateIn() {
        let type = this.selected?.GetType();

        if ( type && (type === EditorElementTypes.Group || type === EditorElementTypes.RepetitionGroup) ){
            for (let i = 0; i < this.selected.GetLength(); ++i){
                let elem = this.selected.GetElem(i);
                if ( elem.GetType() != EditorElementTypes.NewLine && elem.GetType() != EditorElementTypes.Tab) {
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
                if ( elem.GetType() != EditorElementTypes.NewLine && elem.GetType() != EditorElementTypes.Tab ){
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
                if ( elem.GetType() != EditorElementTypes.NewLine && elem.GetType() != EditorElementTypes.Tab ){
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
                    if ( elem.GetType() != EditorElementTypes.NewLine && elem.GetType() != EditorElementTypes.Tab){
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
                    if ( elem.GetType() != EditorElementTypes.NewLine && elem.GetType() != EditorElementTypes.Tab ){
                        this.Select(elem);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    pendingCommand;

    ExecuteCommand(command){
        if (this.commands.GetRedoSize() && !this.undoToastMessageDisabled && !this.undoToastMessageVisible){
            this.pendingCommand = command;
            this.AppendUndoToastMessage();
            return;
        }

        if (this.undoToastMessageVisible)
            this.pendingCommand = command;
        else{
            this.commands.ExecuteAndAppend(command);
            this.editorToolbar.EnableButton('editor-toolbar-undo-button');
            this.editorToolbar.DisableButton('editor-toolbar-redo-button');
        }
    }

    AppendUndoToastMessage(){
        this.undoToastMessageVisible = true;

        this.undoToastMessage = new ToastMessage({
            type: ToastMessage.Types.Information,
            title: 'Redo will not be available',
            explanation:    `After editting, the redo action will not be available for the commands that 
                            are currently on your redo history`,
            buttons: [
                {
                    name: 'Ok',
                    handler: (toastMessage) => {
                        this.undoToastMessageVisible = false;
                        toastMessage.Destroy();

                        if(this.pendingCommand){
                            this.commands.ExecuteAndAppend(this.pendingCommand);
                            this.pendingCommand = undefined;
                            this.editorToolbar.EnableButton('editor-toolbar-undo-button');
                            this.editorToolbar.DisableButton('editor-toolbar-redo-button');
                        }
                    }
                },
                {
                    name: 'Ok and don\'t show this again',
                    handler: (toastMessage) => { 
                        this.undoToastMessageVisible = false, this.undoToastMessageDisabled = true; 
                        toastMessage.Destroy();

                        if(this.pendingCommand){
                            this.commands.ExecuteAndAppend(this.pendingCommand);
                            this.pendingCommand = undefined;
                            this.editorToolbar.EnableButton('editor-toolbar-undo-button');
                            this.editorToolbar.DisableButton('editor-toolbar-redo-button');
                        }
                    }
                },
                {
                    name: 'Cancel',
                    handler: (toastMessage) => {
                        this.undoToastMessageVisible = false, toastMessage.Destroy();
                        this.pendingCommand = undefined;
                    }
                }
            ]
        });

        this.undoToastMessage.SetOnClose( () => {
            this.undoToastMessageVisible = false;
            this.pendingCommand = undefined;
        });

        this.AppendToastMessage(this.undoToastMessage);
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
            this.ExecuteCommand( new DeleteUntilPossibleCommand(this, prev) );
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
            this.commands.Undo();

            if (!this.commands.GetUndoSize()){
                this.editorToolbar.DisableButton('editor-toolbar-undo-button');
            }

            this.editorToolbar.EnableButton('editor-toolbar-redo-button');
        }
    }

    EventHandler_Redo_(){
        if (this.commands.GetRedoSize()){
            this.commands.Redo();

            if (!this.commands.GetRedoSize()){
                this.editorToolbar.DisableButton('editor-toolbar-redo-button');
            }

            this.editorToolbar.EnableButton('editor-toolbar-undo-button');
        }
    }

    sourceTextPrettyPrintElements = [];

    EventHandler_EnterBlockView(){
        if (this.viewMode === EditorElementViewMode.BlockView) return;
        
        this.ExitFromJavascriptView();

        this.viewMode = EditorElementViewMode.BlockView;

        this.code.ForEachRec( elem => {
            if (elem.GetType() === EditorElementTypes.NewLine || elem.GetType() === EditorElementTypes.Tab)
                elem.GetWholeView().removeClass('hidden');
        });

        if (this.theme['Source Text Pretty Print']){
            for (let ppElem of this.sourceTextPrettyPrintElements)
                ppElem.GetParent().RemoveElem(ppElem);
            
            this.sourceTextPrettyPrintElements = [];
        }

        this.code.ForEachRec( elem => elem.ApplyViewMode(this.viewMode));
    }

    EventHandler_EnterSourceCodeView(){
        if (this.viewMode === EditorElementViewMode.PureTextView) return;
        
        this.ExitFromJavascriptView();
        this.Select(undefined);

        this.viewMode = EditorElementViewMode.PureTextView;

        this.code.ForEachRec( elem => {
            if (elem.GetType() === EditorElementTypes.NewLine || elem.GetType() === EditorElementTypes.Tab)
                elem.GetWholeView().addClass('hidden');
        });

        if (this.theme['Source Text Pretty Print']){
            this.code.ForEachRec(
                elem => {
                    let ppElems = this.ApplyPrettyPrint(
                        elem,
                        this.theme['Source Text Pretty Print'],
                        EditorElementViewMode.PureTextView
                    );

                    if (ppElems)
                        this.sourceTextPrettyPrintElements.push( ...ppElems.map(tupple => tupple.indentationChar) );
                }
            );
        }

        this.code.ForEachRec( elem => elem.ApplyViewMode(this.viewMode) );
    }

    EventHandler_Enter_JavascriptView(){
        if (!this.onConvertToJs)                        return;
        if (this.viewMode == Editor.ViewMode.JsView)    return;

        this.EventHandler_EnterBlockView();

        this.viewMode = Editor.ViewMode.JsView;

        let code = EditorElementParser.FromJson( this.code.ToJsonRec(), (elem) => {
            if (elem.GetType() === EditorElementTypes.Group || elem.GetType() === EditorElementTypes.RepetitionGroup){
                elem.elems = elem.elems.filter(elem =>
                    elem.GetType() !== EditorElementTypes.NewLine &&
                    elem.GetType() !== EditorElementTypes.Tab
                );
            }
        });

        let js = this.onConvertToJs(code);

        this.$code.hide();
        this.$jsCode.show().val(js);
    }

    ExitFromJavascriptView(){
        if (this.viewMode !== Editor.ViewMode.JsView) return;

        this.$code.show();
        this.$jsCode.hide().val('');
    }

    EventHandler_Beautify(){
        this.ExecuteCommand( new BeautifyCommand(this) );
    }

    SetOnExecute(f){
        this.onExecute = f;
    }

    SetOnConvertToJs(f){
        this.onConvertToJs = f;
    }

    EventHandler_Execute(){
        if (this.onExecute){
            let code = EditorElementParser.FromJson( this.code.ToJsonRec(), (elem) => {
                if (elem.GetType() === EditorElementTypes.Group || elem.GetType() === EditorElementTypes.RepetitionGroup){
                    elem.elems = elem.elems.filter(elem =>
                        elem.GetType() !== EditorElementTypes.NewLine &&
                        elem.GetType() !== EditorElementTypes.Tab
                    );
                }
            });

            this.onExecute(code);           
        }
    }

    EventHandler_ShowGenerationPath() {
        this.generationPathPopup?.Destroy();
        this.generationPathPopup = new GenerationPathPopup(this.$workspace, this.selected);
        
        this.generationPathPopup.SetOnClose(() => {
            this.editorToolbar.EnableButton('editor-toolbar-blocks-button');
            this.editorToolbar.EnableButton('editor-toolbar-source-code-button');

            if (this.commands.GetUndoSize())    this.editorToolbar.EnableButton('editor-toolbar-undo-button');
            if (this.commands.GetRedoSize())    this.editorToolbar.EnableButton('editor-toolbar-redo-button');
            if (this.onExecute)                 this.editorToolbar.EnableButton('editor-toolbar-play-button');
            if (this.onConvertToJs)             this.editorToolbar.EnableButton('editor-toolbar-js-button');
        });

        this.editorToolbar.DisableButton('editor-toolbar-blocks-button');
        this.editorToolbar.DisableButton('editor-toolbar-source-code-button');
        this.editorToolbar.DisableButton('editor-toolbar-undo-button');
        this.editorToolbar.DisableButton('editor-toolbar-redo-button');
        this.editorToolbar.DisableButton('editor-toolbar-play-button');
        this.editorToolbar.DisableButton('editor-toolbar-js-button');

        this.generationPathPopup.Render();
    }
}