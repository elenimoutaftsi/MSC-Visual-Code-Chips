import { AstVisitor } from './AstVisitor.js';
import { assert } from '../Utils/Assert.js';
import { EditorElementTypes } from '../Editor/EditorElements/EditorElement.js';
import { ReservedWords } from '../Utils/ReservedWords.js';

export class toCVisitor extends AstVisitor {

    stack = [];
    scopeStack = [
        {
            args:   [],
            vars:   [],
            funcs:  []
        }
    ];

    operators = {
        'MEMBER_ACCESS':        { js: '.',      precedence: 20,   associativity: 'left',    },
        'BRACE_MEMBER_ACCESS':  { js: '[]',     precedence: 20,   associativity: 'left',    },
        'PARENTHESIS_CALL':     { js: '()',     precedence: 20,   associativity: 'left',    },
        'UMINUS':               { js: '-',      precedence: 17,   associativity: 'right',   assocParenthesis: 'when_same_ops'  },
        'NOT':                  { js: '!',      precedence: 17,   associativity: 'right',   assocParenthesis: 'never'   },

        'TIMES':                { js: '*',      precedence: 15,   associativity: 'left',    assocParenthesis: 'when_different_ops'  },
        'BY':                   { js: '/',      precedence: 15,   associativity: 'left',    assocParenthesis: 'always'  },
        'MODULO':               { js: '%',      precedence: 15,   associativity: 'left',    assocParenthesis: 'always'  },
        'PLUS':                 { js: '+',      precedence: 14,   associativity: 'left',    assocParenthesis: 'never'   },
        'MINUS':                { js: '-',      precedence: 14,   associativity: 'left',    assocParenthesis: 'never'   },

        'PLUS_PLUS':            { js: '++',     precedence: 14,   associativity: 'left',    assocParenthesis: 'never'   },
        'MINUS_MINUS':          { js: '--',     precedence: 14,   associativity: 'left',    assocParenthesis: 'never'   },
        'PLUS_EQUALS':          { js: '+=',     precedence: 14,   associativity: 'right',    assocParenthesis: 'never'   },
        'MINUS_EQUALS':         { js: '-=',     precedence: 14,   associativity: 'right',    assocParenthesis: 'never'   },
        'TIMES_EQUALS':         { js: '*=',     precedence: 14,   associativity: 'right',    assocParenthesis: 'never'   },
        'BY_EQUALS':            { js: '/=',     precedence: 14,   associativity: 'right',    assocParenthesis: 'never'   },
        'MOD_EQUALS':           { js: '%=',     precedence: 14,   associativity: 'right',    assocParenthesis: 'never'   },

        'GREATER':              { js: '>',      precedence: 12,   associativity: 'left',    assocParenthesis: 'always'  },
        'LESS':                 { js: '<',      precedence: 12,   associativity: 'left',    assocParenthesis: 'always'  },
        'GREATER_EQUAL':        { js: '>=',     precedence: 12,   associativity: 'left',    assocParenthesis: 'always'  },
        'LESS_EQUAL':           { js: '<=',     precedence: 12,   associativity: 'left',    assocParenthesis: 'always'  },
        'EQUAL_TO':             { js: '==',     precedence: 11,   associativity: 'left',    assocParenthesis: 'always'  },
        'NOT_EQUAL_TO':         { js: '!=',     precedence: 11,   associativity: 'left',    assocParenthesis: 'always'  },
        'AND':                  { js: '&&',     precedence: 7,    associativity: 'left',    assocParenthesis: 'never'   },
        'OR':                   { js: '||',     precedence: 6,    associativity: 'left',    assocParenthesis: 'never'   },
        'EQUALS':               { js: '=',      precedence: 3,    associativity: 'right',   assocParenthesis: 'never'   },
    };

    currTabs = 0;
    currTabStr = '';

    IncreaseTabs(){
        this.currTabs++;
        this.currTabStr += '\t';
    }

    DecreaseTabs(){
        assert(this.currTabs >= 1, 'Trying to decrease to negative tabs');
        this.currTabs--;

        this.currTabStr = '\t'.repeat(this.currTabs);
    }

    TabIn(str, tabs = this.currTabs){
        if (tabs === 0)
            return str;
        
        if (tabs = this.currTabs)
            return this.currTabStr + str;
        else
            return '\t'.repeat(tabs) + str;
    }

    constructor() {
        super();
        this.InitVisitors();
    }

    InitVisitors() {
        this.SetVisitor( 'program',                 elem => this.Visit_Program(elem) );
        this.SetVisitor( 'stmts',                   elem => this.Visit_Stmts(elem) );
        this.SetVisitor( 'defs',                    elem => this.Visit_Defs(elem) );
        this.SetVisitor( 'stmt',                    elem => this.Visit_Stmt(elem) );
        this.SetVisitor( 'def',                     elem => this.Visit_Def(elem) );
        this.SetVisitor( 'var_decl',                elem => this.Visit_VarDecl(elem) ); 
        this.SetVisitor( 'var_def',                 elem => this.Visit_VarDef(elem) ); 
        this.SetVisitor( 'var_type',                elem => this.Visit_VarType(elem) ); 
        this.SetVisitor( 'struct_def',              elem => this.Visit_StructDef(elem) ); 
        this.SetVisitor( 'struct_field',            elem => this.Visit_Struct_Field(elem) ); 
        this.SetVisitor( 'func_def',                elem => this.Visit_FuncDefStmt(elem) );
        this.SetVisitor( 'func_type',               elem => this.Visit_FuncType(elem) ); 
        this.SetVisitor( 'if_stmt',                 elem => this.Visit_IfStmt(elem) );
        this.SetVisitor( 'if_else_stmt',            elem => this.Visit_IfElseStmt(elem) );
        this.SetVisitor( 'while_stmt',              elem => this.Visit_WhileStmt(elem) );
        this.SetVisitor( 'for_stmt',                elem => this.Visit_ForStmt(elem) );
        this.SetVisitor( 'expr',                    elem => this.Visit_Expr(elem) );
        this.SetVisitor( 'break_stmt',              elem => this.Visit_BreakStmt(elem) );
        this.SetVisitor( 'continue_stmt',           elem => this.Visit_ContinueStmt(elem) );
        this.SetVisitor( 'return_stmt',             elem => this.Visit_ReturnStmt(elem) );
        this.SetVisitor( 'arith_expr',              elem => this.Visit_ArithExpr(elem) );
        this.SetVisitor( 'rel_expr',                elem => this.Visit_RelExpr(elem) );
        this.SetVisitor( 'logical_expr',            elem => this.Visit_LogicalExpr(elem) );
        this.SetVisitor( 'assign_expr',             elem => this.Visit_AssignExpr(elem) );
        this.SetVisitor( 'call_expr',               elem => this.Visit_CallExpr(elem) );
        this.SetVisitor( 'primary_expr',            elem => this.Visit_PrimaryExpr(elem) );
        this.SetVisitor( 'binary_arith_expr',       elem => this.Visit_BinaryArithExpr(elem) );
        this.SetVisitor( 'unary_minus_expr',        elem => this.Visit_UnaryMinusExpr(elem) );
        this.SetVisitor( 'unary_expr',              elem => this.Visit_UnaryExpr(elem) );
        this.SetVisitor( 'unary_back_expr',         elem => this.Visit_UnaryBackExpr(elem) );
        this.SetVisitor( 'unary_front_expr',        elem => this.Visit_UnaryFrontExpr(elem) );
        this.SetVisitor( 'arith_op',                elem => this.Visit_ArithOp(elem) );
        this.SetVisitor( 'rel_op',                  elem => this.Visit_RelOp(elem) );
        this.SetVisitor( 'logical_binary_op',       elem => this.Visit_LogicalBinaryOp(elem) );
        this.SetVisitor( 'assign_op',               elem => this.Visit_AssignOp(elem) ); //
        this.SetVisitor( 'unary_op',                elem => this.Visit_UnaryOp(elem) ); //
        this.SetVisitor( 'binary_logical_expr',     elem => this.Visit_BinaryLogicalExpr(elem) );
        this.SetVisitor( 'not_expr',                elem => this.Visit_NotExpr(elem) );
        this.SetVisitor( 'BOOL_CONST_',             elem => this.Visit_BoolConst_(elem) );
        this.SetVisitor( 'const_values',            elem => this.Visit_ConstValues(elem) ); //
        this.SetVisitor( 'input_output_call',       elem => this.Visit_InputOutputCall(elem) );
        this.SetVisitor( 'math_call',               elem => this.Visit_MathCall(elem) );
        this.SetVisitor( 'string_method_call',      elem => this.Visit_StringMethodCall(elem) );
        this.SetVisitor( 'user_function_call',      elem => this.Visit_UserFunctionCall(elem) );
        this.SetVisitor( 'ident_list',              elem => this.Visit_IdentList(elem) );
        this.SetVisitor( 'expr_list',               elem => this.Visit_ExprList(elem) );
        this.SetVisitor( 'element_list',            elem => this.Visit_ElementList(elem) );
        this.SetVisitor( 'array_def',               elem => this.Visit_ArrayDef(elem) );//
        this.SetVisitor( 'array_type',              elem => this.Visit_ArrayType(elem) );//
        this.SetVisitor( 'array_index',             elem => this.Visit_ArrayIndex(elem) ); //
        this.SetVisitor( 'array_size',              elem => this.Visit_ArraySize(elem) );
        this.SetVisitor( 'string_append',           elem => this.Visit_StringAppend(elem) );
        this.SetVisitor( 'string_copy_string',      elem => this.Visit_StringCopyString(elem) ); //
        this.SetVisitor( 'string_compare_strings',  elem => this.Visit_StringCompareStrings(elem) ); //
        this.SetVisitor( 'string_size',             elem => this.Visit_StringSize(elem) );
        this.SetVisitor( 'input_output_printf',     elem => this.Visit_InputOutputPrintf(elem) ); //
        this.SetVisitor( 'input_output_scanf',      elem => this.Visit_InputOutputScanf(elem) ); //
        this.SetVisitor( 'printf_type',             elem => this.Visit_PrintfType(elem) ); //
        this.SetVisitor( 'types',                   elem => this.Visit_Types(elem) ); //
        this.SetVisitor( 'variables',               elem => this.Visit_Variables(elem) ); //
        this.SetVisitor( 'scanf_type',              elem => this.Visit_ScanfType(elem) ); //
        this.SetVisitor( 'stypes',                  elem => this.Visit_Stypes(elem) ); //
        this.SetVisitor( 'printf_variable',         elem => this.Visit_PrintfVariable(elem) ); //
        this.SetVisitor( 'scanf_arg',               elem => this.Visit_ScanfArg(elem) ); //
        this.SetVisitor( 'math_pow',                elem => this.Visit_MathPow(elem) );
        this.SetVisitor( 'math_sqrt',               elem => this.Visit_MathSqrt(elem) );
        this.SetVisitor( 'math_round',              elem => this.Visit_MathRound(elem) );
        this.SetVisitor( 'math_floor',              elem => this.Visit_MathFloor(elem) );
        this.SetVisitor( 'math_ceiling',            elem => this.Visit_MathCeiling(elem) );
        this.SetVisitor( 'math_sin',                elem => this.Visit_MathSin(elem) );
        this.SetVisitor( 'math_cos',                elem => this.Visit_MathCos(elem) );


        this.SetVisitor( 'IDENT',                   elem => this.Visit_Ident(elem) );
        this.SetVisitor( 'INT_CONST',               elem => this.Visit_IntConst(elem) );
        this.SetVisitor( 'FLOAT_CONST',             elem => this.Visit_FloatConst(elem) );
        this.SetVisitor( 'BOOL_CONST',              elem => this.Visit_BoolConst(elem) );
        this.SetVisitor( 'CHAR_CONST',              elem => this.Visit_CharConst(elem) );
        this.SetVisitor( 'STRING_CONST',            elem => this.Visit_StringConst(elem) );
        this.SetVisitor( 'UMINUS',                  elem => this.Visit_Uminus(elem) );
        this.SetVisitor( 'PLUS',                    elem => this.Visit_Plus(elem) );
        this.SetVisitor( 'MINUS',                   elem => this.Visit_Minus(elem) );
        this.SetVisitor( 'TIMES',                   elem => this.Visit_Times(elem) );
        this.SetVisitor( 'BY',                      elem => this.Visit_By(elem) );
        this.SetVisitor( 'MODULO',                  elem => this.Visit_Modulo(elem) );
        this.SetVisitor( 'GREATER',                 elem => this.Visit_Greater(elem) );
        this.SetVisitor( 'LESS',                    elem => this.Visit_Less(elem) );
        this.SetVisitor( 'EQUAL_TO',                elem => this.Visit_EqualTo(elem) );
        this.SetVisitor( 'NOT_EQUAL_TO',            elem => this.Visit_NotEqualTo(elem) );
        this.SetVisitor( 'GREATER_EQUAL',           elem => this.Visit_GreaterEqual(elem) );
        this.SetVisitor( 'LESS_EQUAL',              elem => this.Visit_LessEqual(elem) );
        this.SetVisitor( 'PLUS_PLUS',               elem => this.Visit_Plus_Plus(elem) );//
        this.SetVisitor( 'MINUS_MINUS',             elem => this.Visit_Minus_Minus(elem) );//
        this.SetVisitor( 'PLUS_EQUALS',             elem => this.Visit_PlusEquals(elem) );//
        this.SetVisitor( 'MINUS_EQUALS',            elem => this.Visit_Minus_Equals(elem) );//
        this.SetVisitor( 'TIMES_EQUALS',            elem => this.Visit_Times_Equals(elem) );//
        this.SetVisitor( 'BY_EQUALS',               elem => this.Visit_By_Equals(elem) );//
        this.SetVisitor( 'MOD_EQUALS',              elem => this.Visit_Mod_Equals(elem) );//
        this.SetVisitor( 'int',                     elem => this.Visit_Int(elem) );
        this.SetVisitor( 'char',                    elem => this.Visit_Char(elem) );
        this.SetVisitor( 'float',                   elem => this.Visit_Float(elem) );
        this.SetVisitor( 'double',                  elem => this.Visit_Double(elem) );
        this.SetVisitor( 'void',                    elem => this.Visit_Void(elem) );
        this.SetVisitor( 'AND',                     elem => this.Visit_And(elem) );
        this.SetVisitor( 'OR',                      elem => this.Visit_Or(elem) );
        this.SetVisitor( 'NOT',                     elem => this.Visit_Not(elem) );
        this.SetVisitor( 'EQUALS',                  elem => this.Visit_Equals(elem) );
        this.SetVisitor( 'true',                    elem => this.Visit_True(elem) );
        this.SetVisitor( 'false',                   elem => this.Visit_False(elem) );
        this.SetVisitor( 'BREAK',                   elem => this.Visit_Break(elem) );
        this.SetVisitor( 'CONTINUE',                elem => this.Visit_Continue(elem) );
        this.SetVisitor( 'RETURN',                  elem => this.Visit_Return(elem) );
        this.SetVisitor( 'IF',                      elem => this.Visit_If(elem) );
        this.SetVisitor( 'ELSE',                    elem => this.Visit_Else(elem) );
        this.SetVisitor( 'WHILE',                   elem => this.Visit_While(elem) );
        this.SetVisitor( 'FOR',                     elem => this.Visit_For(elem) );
        //this.SetVisitor( 'FUNCTION',                elem => this.Visit_Function(elem) );
        this.SetVisitor( 'get_size',                elem => this.Visit_GetSize(elem) );
        this.SetVisitor( 'append',                  elem => this.Visit_Append(elem) );
        this.SetVisitor( 'strcpy',                  elem => this.Visit_Strcpy(elem) ); 
        this.SetVisitor( 'strcmp',                  elem => this.Visit_Strcmp(elem) ); 
        this.SetVisitor( 'strlen',                  elem => this.Visit_Strlen(elem) ); 
        this.SetVisitor( 'struct',                  elem => this.Visit_Struct(elem) ); 
        this.SetVisitor( 'printf',                  elem => this.Visit_Printf(elem) ); 
        this.SetVisitor( 'scanf',                   elem => this.Visit_Scanf(elem) );  
        this.SetVisitor( 'pow',                     elem => this.Visit_Pow(elem) );
        this.SetVisitor( 'sqrt',                    elem => this.Visit_Sqrt(elem) );
        this.SetVisitor( 'round',                   elem => this.Visit_Round(elem) );
        this.SetVisitor( 'floor',                   elem => this.Visit_Floor(elem) );
        this.SetVisitor( 'ceiling',                 elem => this.Visit_Ceiling(elem) );
        this.SetVisitor( 'sin',                     elem => this.Visit_Sin(elem) );
        this.SetVisitor( 'cos',                     elem => this.Visit_Cos(elem) );
        this.SetVisitor( '%d',                     elem => this.Visit_Intt(elem) );
        this.SetVisitor( '%f',                     elem => this.Visit_Doublee(elem) );
        this.SetVisitor( '%c',                     elem => this.Visit_Charr(elem) );
        this.SetVisitor( '[',                      elem => this.Visit_SqBracket1(elem) );
        this.SetVisitor( ']',                      elem => this.Visit_SqBracket2(elem) );
        this.SetVisitor( '{',                      elem => this.Visit_Bracket1(elem) );
        this.SetVisitor( '}',                      elem => this.Visit_Bracket2(elem) );
        this.SetVisitor( '(',                      elem => this.Visit_Parenth1(elem) );
        this.SetVisitor( ')',                      elem => this.Visit_Parenth2(elem) );
        this.SetVisitor( '.',                      elem => this.Visit_Dot(elem) );
    }

    HandleVarDeclaration(id){
        if (    
            !this.scopeStack.some(f =>
                f.funcs.includes(id)    ||
                f.vars.includes(id)     ||
                f.args.includes(id)
            )
        )
            this.scopeStack[this.scopeStack.length - 1].vars.push(id);
    }

    PopScopeVars(){
        let vars = this.scopeStack.pop().vars.join(', ');

        if (vars)
            vars = `var ${vars};\n`;

        return vars;
    }

    PopChildrenFromStack(elem, resultKeys) {
        let numChildren =   elem.GetElems().length;

        if (resultKeys)
            assert(
                numChildren === resultKeys.length,
                `Expected node of type ${elem.GetSymbol().symbol} to have ${resultKeys.length} children but it has ${numChildren}`
            );

        assert(numChildren <= this.stack.length);

        let childrenCode = [];

        for (let i = 0; i < numChildren; ++i)
            childrenCode.unshift(this.stack.pop());

        if (!resultKeys)
            return childrenCode;
        else {
            let result  = {};
    
            for (let i = 0; i < numChildren; ++i)
                result[resultKeys[i]] = childrenCode[i];
        
            return result;
        }
    }

    HandleSemicolon(elem, code){
        let parent = elem.GetParent()?.GetSymbol().symbol.name;
        if (parent === 'stmts' || parent === 'defs')
            return code + ';'
        else
            return code;
    }

    ToOperator(elem){
        if (elem.GetType() !== EditorElementTypes.SimpleBlock && elem.GetType() !== EditorElementTypes.SelectionBlock)
            return false;

        let op = elem.GetSymbol().symbol.name;

        /* handle operator placeholders */
        switch (op) {
            case 'arith_op':            return this.operators.PLUS;
            case 'rel_op':              return this.operators.GREATER;
            case 'logical_binary_op':   return this.operators.AND;
            case 'array_method':        return this.operators.MEMBER_ACCESS;
            case 'string_method':       return this.operators.MEMBER_ACCESS;
        }

        return this.operators[op];
    }

    GetChildOperator(elem){
        if (elem.GetType() !== EditorElementTypes.Group)
            return;

        /* Handle unary and binary arithmetic, relative, logical expressions */

        let children = elem.GetElems();

        for (let i = 0; i < children.length && i < 2; ++i){
            let operator = this.ToOperator(children[i]);

            if (operator) return operator;
        }

        /* Handle operators that appear in the generated code but not on the source blocks */

        let name = elem.GetSymbol().symbol.name;

        switch (name) {
            case 'math_pow':                    return this.operators.MEMBER_ACCESS;
            case 'math_sqrt':                   return this.operators.MEMBER_ACCESS;
            case 'math_round':                  return this.operators.MEMBER_ACCESS;
            case 'math_floor':                  return this.operators.MEMBER_ACCESS;
            case 'math_ceiling':                return this.operators.MEMBER_ACCESS;
            case 'math_sin':                    return this.operators.MEMBER_ACCESS;
            case 'math_cos':                    return this.operators.MEMBER_ACCESS;
            
            case 'array_get':                   return this.operators.MEMBER_ACCESS;
            case 'array_insert':                return this.operators.MEMBER_ACCESS;
            case 'array_push_back':             return this.operators.MEMBER_ACCESS;
            case 'array_set':                   return this.operators.EQUALS;
            
            case 'get_size':                    return this.operators.MEMBER_ACCESS;

            case 'string_append':               return this.operators.MEMBER_ACCESS;
            case 'string_get_character':        return this.operators.MEMBER_ACCESS;
            case 'string_get_substring':        return this.operators.MEMBER_ACCESS;

            case 'array_method_call':           return this.ToOperator(elem.GetElems()[3]) || this.GetChildOperator(elem.GetElems()[3]);
            case 'string_method_call':          return this.ToOperator(elem.GetElems()[3]) || this.GetChildOperator(elem.GetElems()[3]);
        }
    }

    GetResult(){
        if (this.stack.length === 1)
            return this.stack[0];
        else 
            assert(false, 'stack is either empty or contains more than 1 element');
    }

    ShouldParenthesize(outerOp, innerOp, innerOpPosition){
        if (innerOp.precedence < outerOp.precedence)
            return true;

        if (innerOp.precedence == outerOp.precedence){
            if (innerOp.assocParenthesis){
                switch(innerOp.assocParenthesis){
                    case 'always':
                        return true;
                    case 'never':
                        return false;
                    case 'when_different_ops':
                        return innerOp !== outerOp;
                    case 'when_same_ops':
                        return innerOp === outerOp;
                }
            }

            return innerOp.associativity !== innerOpPosition;
        }

        return false;
    }

    HandleBinaryExpr(elem){
        let code = this.PopChildrenFromStack(elem, ['expr1', 'op', 'expr2']);

        let elems = elem.GetElems();

        let outerOp = this.ToOperator(elems[1]), op1 = this.GetChildOperator(elems[0]), op2 = this.GetChildOperator(elems[2]);

        if ( op1 && this.ShouldParenthesize(outerOp, op1, 'left') )
            code.expr1 = `(${code.expr1})`;
        
        if ( op2 && this.ShouldParenthesize(outerOp, op2, 'right') )
            code.expr2 = `(${code.expr2})`;

        this.stack.push(
            this.HandleSemicolon(elem, `${code.expr1} ${code.op} ${code.expr2}`)
        );
    }

    HandleUnaryExpr(elem){
        let code = this.PopChildrenFromStack(elem, ['op', 'expr']);

        let elems = elem.GetElems();

        let outerOp = this.ToOperator(elems[0]), op = this.GetChildOperator(elems[1]);
        
        if ( op && this.ShouldParenthesize(outerOp, op, 'right') )
            code.expr = `(${code.expr})`;

        this.stack.push(
            this.HandleSemicolon(elem, `${code.op}${code.expr}`)
        );
    }

    Visit_Program(elem) {
        assert(false);
    }

    Visit_Stmts(elem) {
        let childrenCode = this.PopChildrenFromStack(elem).map( stmt => this.TabIn(stmt) ).join('\n');

        if (elem.GetParent()){
            this.stack.push(childrenCode);
        }else
            this.stack.push(
                this.TabIn( this.PopScopeVars() ) + childrenCode 
            );
    }

    Visit_Defs(elem) {
        let childrenCode = this.PopChildrenFromStack(elem).map( stmt => this.TabIn(stmt) ).join('\n');
        let vars = this.TabIn( this.PopScopeVars() );
        
        this.stack.push('#include <stdio.h>\n\nint main() {\n\n ' + childrenCode +'\n\n}' );
    }

    Visit_Stmt(elem) {
        this.stack.push( ';' );
    }

    Visit_Def(elem) {
        this.stack.push( ';' );
    }

    Visit_VarDecl(elem) {
        this.stack.push( '' );
    }

    Visit_VarDef(elem) {
        let code = this.PopChildrenFromStack(elem, ['var_type', 'id']);
        let parent = elem.GetParent()?.GetParent()?.GetSymbol().symbol.name;
        
        if (parent === 'func_def')
            this.stack.push( ` ${code.var_type} ${code.id}` );
        else
            this.stack.push( ` ${code.var_type} ${code.id};` );
    }

    Visit_VarType(elem) {
        this.stack.push( '' );
    }

    Visit_StructDef(elem) { 
        let code = this.PopChildrenFromStack(elem, ['struct', 'id' , '{', 'ident_list' , '}']);

        this.stack.push( `struct ${code.id}  { \n${code.ident_list} \n} ; ` );
    }

    Visit_Struct_Field(elem) { 
        let code = this.PopChildrenFromStack(elem, [ 'id1' , '.', 'id2']);

        this.stack.push( ` ${code.id1}.${code.id2} ` );
    }
    
    Visit_FuncDefStmt(elem){ ////

        this.IncreaseTabs();

        this.scopeStack.push({
            args:       [],
            vars:       [],
            funcs:      [],
        });

        let code = this.PopChildrenFromStack(elem, ['func_type', 'id', '(', 'ident_list',  ')', '{', 'stmts', '}']);
        let vars = this.TabIn( this.PopScopeVars() );

        this.DecreaseTabs();
        let rBrace = this.TabIn('}');

        this.stack.push(`${code.func_type} ${code.id} ( ${code.ident_list} ) { \n ${code.stmts}\n } `);
    }

    Visit_FuncType(elem){
        this.stack.push( ';' );
    }

    Visit_IfStmt(elem) {
        let code = this.PopChildrenFromStack(elem, ['if', 'expr', 'stmts']);
        
        this.DecreaseTabs();
        
        let rBrace = this.TabIn('}');

        this.stack.push( `if (${code.expr}) {\n${code.stmts}\n${rBrace}` );
    }

    Visit_IfElseStmt(elem){
        let code = this.PopChildrenFromStack(elem, ['if', 'expr', 'stmts1', 'else', 'stmts2']);
        
        this.DecreaseTabs();

        let rBrace = this.TabIn('}');
        let else_ = this.TabIn('else');

        this.stack.push( `if (${code.expr}) {\n${code.stmts1}\n${rBrace}\n${else_} {\n${code.stmts2}\n${rBrace}` );
    }

    Visit_WhileStmt(elem){
        let code = this.PopChildrenFromStack(elem, ['while', 'expr', 'stmts']);

        this.DecreaseTabs();
        let rBrace = this.TabIn('}');

        this.stack.push( `while (${code.expr}) {\n${code.stmts}\n${rBrace}` );
    }

    Visit_ForStmt(elem){
        let code = this.PopChildrenFromStack(elem, ['for', 'init', 'condition', 'step', 'stmts']);

        this.DecreaseTabs();
        let rBrace = this.TabIn('}');

        this.stack.push( `for (${code.init}; ${code.condition}; ${code.step}) {\n${code.stmts}\n${rBrace}` );
    }

    Visit_Expr(elem){
        this.stack.push(
            this.HandleSemicolon(elem, `0`)
        );
    }

    Visit_BreakStmt(elem){
        assert(false);
    }

    Visit_ContinueStmt(elem){
        assert(false);
    }

    Visit_ReturnStmt(elem){
        let code = this.PopChildrenFromStack(elem, ['return', 'expr']);

        this.stack.push(`return ${code.expr};`);
    }

    Visit_ArithExpr(elem){
        this.stack.push(
            this.HandleSemicolon(elem, `0`)
        );
    }

    Visit_RelExpr(elem){
        this.HandleBinaryExpr(elem);
    }

    Visit_LogicalExpr(elem){
        this.stack.push(
            this.HandleSemicolon(elem, `0`)
        );
    }

    Visit_AssignExpr(elem){
        this.HandleBinaryExpr(elem);
    }  

     Visit_CallExpr(elem){
        this.stack.push(
            this.HandleSemicolon(elem, `0`)
        );
    }    

    Visit_PrimaryExpr(elem){
        this.stack.push(
            this.HandleSemicolon(elem, `0`)
        );
    }    

    Visit_BinaryArithExpr(elem){
        this.HandleBinaryExpr(elem);
    }

    Visit_UnaryMinusExpr(elem){
        this.HandleUnaryExpr(elem);
    }

    Visit_UnaryExpr(elem){ //
        this.HandleUnaryExpr(elem);
    }

    Visit_UnaryBackExpr(elem){ //
        this.HandleUnaryExpr(elem);
    }

    Visit_UnaryFrontExpr(elem){ //
        this.HandleUnaryExpr(elem);
    }

    Visit_ArithOp(elem){
        this.stack.push(`+`);
    }

    Visit_RelOp(elem){
        this.stack.push(`>`);
    }

    Visit_AssignOp(elem){ 
        this.stack.push(`=`);
    }

    Visit_UnaryOp(elem){ 
        this.stack.push(`+`);
    }

    Visit_LogicalBinaryOp(elem){
        this.stack.push(`&&`);
    }

    Visit_BinaryLogicalExpr(elem){
        this.HandleBinaryExpr(elem);
    }

    Visit_NotExpr(elem){
        this.HandleUnaryExpr(elem);
    }

    Visit_BoolConst_(elem){
        this.stack.push(
            this.HandleSemicolon(elem, `false`)
        );
    }

    Visit_ConstValues(elem){ //
        this.stack.push(
            this.HandleSemicolon(elem, `false`)
        );
    }

    Visit_InputOutputCall(elem){
        this.stack.push(
            this.HandleSemicolon(elem, `0`)
        );
    }
    
    Visit_MathCall(elem){
        this.stack.push(
            this.HandleSemicolon(elem, `0`)
        );
    }

    Visit_StringMethodCall(elem){
        this.stack.push(
            this.HandleSemicolon(elem, `0`)
        );
    }

    Visit_UserFunctionCall(elem){ //
        let code = this.PopChildrenFromStack(elem, ['id', 'args']);

        this.stack.push(
            this.HandleSemicolon(elem, `${code.id}( ${code.args} )`)
        );
    }

    Visit_IdentList(elem){
        let parent = elem.GetParent()?.GetSymbol().symbol.name;

        if (parent === 'struct_def'){
            let code = this.PopChildrenFromStack(elem).join('\n');
            this.stack.push(`${code}`);
        } else{
            let code = this.PopChildrenFromStack(elem).join(', ');
            this.stack.push(`${code}`);
        } 
    }

    Visit_ExprList(elem){
        let code = this.PopChildrenFromStack(elem).join(', ');

        this.stack.push(`${code}`);
    }

    Visit_ElementList(elem){
        let code = this.PopChildrenFromStack(elem).join(', ');

        this.stack.push(`${code}`);
    }

    Visit_ArrayDef(elem){ 
        let code = this.PopChildrenFromStack(elem, ['array_type', 'id' , '[', 'size', ']']);
        let parent = elem.GetParent()?.GetParent()?.GetSymbol().symbol.name;

        if(parent === 'func_def')
            this.stack.push( ` ${code.array_type}  ${code.id} [ ${code.size} ] ` );
        else
            this.stack.push( ` ${code.array_type}  ${code.id} [ ${code.size} ] ; ` );
    }

    Visit_ArrayType(elem){ 
        this.stack.push(``);
    }

    Visit_ArrayIndex(elem){ 
        let code = this.PopChildrenFromStack(elem, [ 'id' , '[', 'size', ']']);

        this.stack.push( ` ${code.id} [ ${code.size} ] ` );
    }

    Visit_ArraySize(elem){
        this.stack.push(``);
    }

    Visit_StringAppend(elem){
        let code = this.PopChildrenFromStack(elem, ['strcat', 'string_dest', 'string_source']);

        this.stack.push(`strcat(${code.string_dest} , ${code.string_source} )`);
    }

    Visit_StringCopyString(elem){ 
        let code = this.PopChildrenFromStack(elem, ['strcpy', 'string_dest', 'string_source']);

        this.stack.push(`strcpy(${code.string_dest} , ${code.string_source} )`);
    }

    Visit_StringCompareStrings(elem){ 
        let code = this.PopChildrenFromStack(elem, ['strcmp', 'string1', 'string2']);

        this.stack.push(`strcmp(${code.string1} , ${code.string2} )`);
    }

    Visit_StringSize(elem){
        let code = this.PopChildrenFromStack(elem, ['strlen', 'string']);

        this.stack.push(`strlen(${code.string})`);
    }

    Visit_InputOutputPrintf(elem){
        let code = this.PopChildrenFromStack(elem, ['printf', 'listargs']);

        this.stack.push(
            this.HandleSemicolon(elem, ` printf ( ${code.listargs} )`)
        );
    }

    Visit_PrintfVariable(elem){ 
        let code = this.PopChildrenFromStack(elem, ['types' , 'variables']);

        this.stack.push(
            this.HandleSemicolon(elem, `${code.types}, ${code.variables}`)
        );
    }

    Visit_PrintfType(elem){ 
        this.stack.push(`%d`);
    }

    Visit_InputOutputScanf(elem){ 
        let code = this.PopChildrenFromStack(elem, ['scanf', 'listargs']);

        this.stack.push(
            this.HandleSemicolon(elem, ` scanf ( ${code.listargs} )`)
        );
    }

    Visit_Types(elem){ 
        let code = this.PopChildrenFromStack(elem).join(' ');

        this.stack.push(`" ${code} " `);
    }

    Visit_ScanfType(elem){ 
        this.stack.push(`%d`);
    }

    Visit_Stypes(elem){ 
        let code = this.PopChildrenFromStack(elem).join(' ');

        this.stack.push(`" ${code} " `);
    }

    Visit_ScanfArg(elem){ 
        let code = this.PopChildrenFromStack(elem, ['stypes', 'variables']);

        this.stack.push( `${code.stypes}, ${code.variables}`);
    }

    Visit_Variables(elem){ 
        let parent = elem.GetParent()?.GetSymbol().symbol.name;

        if (parent === 'scanf_arg'){
            let code = this.PopChildrenFromStack(elem).join(',&');
            this.stack.push(` &${code}`);
        }
        else{
            let code = this.PopChildrenFromStack(elem).join(',');
            this.stack.push(` ${code}`);
        }
    }

    Visit_ListArgs(elem){
        let code = this.PopChildrenFromStack(elem).join(', ');

        this.stack.push(` ${code}`);
    }

    Visit_MathPow(elem){
        let code = this.PopChildrenFromStack(elem, ['pow', 'number', 'exponent']);

        this.stack.push(
            this.HandleSemicolon(elem, `pow( ${code.number}, ${code.exponent})`)
        );
    }
    
    Visit_MathSqrt(elem){
        let code = this.PopChildrenFromStack(elem, ['sqrt', 'number']);

        this.stack.push(
            this.HandleSemicolon(elem, `sqrt(${code.number})`)
        );
    }
    
    Visit_MathRound(elem){
        let code = this.PopChildrenFromStack(elem, ['round', 'number']);

        this.stack.push(
            this.HandleSemicolon(elem, `round(${code.number})`)
        );
    }
    
    Visit_MathFloor(elem){
        let code = this.PopChildrenFromStack(elem, ['floor', 'number']);

        this.stack.push(
            this.HandleSemicolon(elem, `floor(${code.number})`)
        );
    }

    Visit_MathCeiling(elem){
        let code = this.PopChildrenFromStack(elem, ['ceiling', 'number']);

        this.stack.push(
            this.HandleSemicolon(elem, `ceiling(${code.number})`)
        );
    }
    
    Visit_MathSin(elem){
        let code = this.PopChildrenFromStack(elem, ['sin', 'number']);

        let innerOp = this.GetChildOperator(elem.GetElems()[1]);
        
        if ( innerOp && this.ShouldParenthesize(this.operators.BY, innerOp, 'left') )
            code.number = `(${code.number})`;

        this.stack.push(
            this.HandleSemicolon(elem, `sin(${code.number})`)
        );
    }
    
    Visit_MathCos(elem){
        let code = this.PopChildrenFromStack(elem, ['cos', 'number']);

        let innerOp = this.GetChildOperator(elem.GetElems()[1]);
        
        if ( innerOp && this.ShouldParenthesize(this.operators.BY, innerOp, 'left') )
            code.number = `(${code.number})`;

        this.stack.push(
            this.HandleSemicolon(elem, `cos(${code.number})`)
        );
    }

    /* terminals */

    Visit_Ident(elem) {
        let id = elem.GetText();
        
        // if (ReservedWords.IsReserved(id))  || '$$id'
        //     id = '$' + id;
        if(id == null) this.stack.push('ident');
        else this.stack.push(id);
        
        // let parent = elem.GetParent().GetSymbol().symbol.name;

        // if (parent === 'func_def'){
        //     this.scopeStack[this.scopeStack.length - 2].funcs.push(id); // don't care about duplicates
        // }
        // else if (parent === 'ident_list'){
        //     this.scopeStack[this.scopeStack.length - 1].args.push(id); // don't care about duplicates
        // }
        // else
        //     this.HandleVarDeclaration(id);
    }

    Visit_IntConst(elem) {
        let num = Number(elem.GetText());

        if ( !Number.isInteger(num) )
            num = 0;
        
        this.stack.push(num);
    }

    Visit_FloatConst(elem) {
        let num = Number(elem.GetText());

        if ( !Number.isFinite(num) )
            num = 0;
        
        this.stack.push(num);
    }

    Visit_BoolConst(elem) {
        let bool = elem.GetText();

        if (bool !== 'false' && bool !== 'true')
            bool = 'false';

        this.stack.push(bool);
    }
    
    Visit_CharConst(elem) {
        let text = elem.GetText();

        if      (text === '"')  text = '\\"';
        else if (text === '\\') text = '\\\\';

        this.stack.push(text);
    }

    Visit_StringConst(elem) {
        let quotes = /\"/g;
        let backslashes = /\\/g

        let text = elem.GetText().replace(backslashes, '\\\\').replace(quotes, '\\"')


        let parent = elem.GetParent()?.GetSymbol().symbol.name;

        if (parent === 'types')
            this.stack.push(text);
        else{
            text = '"' + elem.GetText().replace(backslashes, '\\\\').replace(quotes, '\\"') + '"'
            this.stack.push(text);
        }
    }

    Visit_Uminus(elem)              { this.stack.push('-'); }
    Visit_Plus(elem)                { this.stack.push('+'); }
    Visit_Minus(elem)               { this.stack.push('-'); }
    Visit_Times(elem)               { this.stack.push('*'); }
    Visit_By(elem)                  { this.stack.push('/'); }
    Visit_Modulo(elem)              { this.stack.push('%'); }
    Visit_Greater(elem)             { this.stack.push('>'); }
    Visit_Less(elem)                { this.stack.push('<'); }
    Visit_EqualTo(elem)             { this.stack.push('=='); }
    Visit_NotEqualTo(elem)          { this.stack.push('!=='); }
    Visit_GreaterEqual(elem)        { this.stack.push('>='); }
    Visit_LessEqual(elem)           { this.stack.push('<='); }
    Visit_Plus_Plus(elem)           { this.stack.push('++'); }
    Visit_Minus_Minus(elem)         { this.stack.push('- -'); }
    Visit_PlusEquals(elem)          { this.stack.push('+='); }
    Visit_Minus_Equals(elem)        { this.stack.push('-='); }
    Visit_Times_Equals(elem)        { this.stack.push('*='); }
    Visit_By_Equals(elem)           { this.stack.push('/='); }
    Visit_Mod_Equals(elem)          { this.stack.push('%='); }
    Visit_Int(elem)                 { this.stack.push('int'); }
    Visit_Char(elem)                { this.stack.push('char'); }
    Visit_Float(elem)               { this.stack.push('float'); }
    Visit_Double(elem)              { this.stack.push('double'); }
    Visit_Void(elem)                { this.stack.push('void'); }
    Visit_And(elem)                 { this.stack.push('&&'); }
    Visit_Or(elem)                  { this.stack.push('||'); }
    Visit_Not(elem)                 { this.stack.push('!'); }
    Visit_Equals(elem)              { this.stack.push('='); }
    Visit_True(elem)                { this.stack.push( this.HandleSemicolon(elem, 'true') ); }
    Visit_False(elem)               { this.stack.push( this.HandleSemicolon(elem, 'false') ); }
    Visit_Break(elem)               { this.stack.push('break;'); }
    Visit_Continue(elem)            { this.stack.push('continue;'); }
    Visit_Return(elem)              { this.stack.push('return'); }

    Visit_If(elem)                  { this.IncreaseTabs(); this.stack.push(null); }
    Visit_Else(elem)                { this.stack.push(null); }
    Visit_While(elem)               { this.IncreaseTabs(); this.stack.push(null); }
    Visit_For(elem)                 { this.IncreaseTabs(); this.stack.push(null); }
    
    // Visit_Function(elem) {
    //     this.IncreaseTabs();

    //     this.scopeStack.push({
    //         args:       [],
    //         vars:       [],
    //         funcs:      [],
    //     });

    //     this.stack.push(null);
    // }
    
    Visit_GetSize(elem) {
        this.stack.push(
            this.HandleSemicolon(elem, `.length`)
        );
    }
    
    Visit_Append(elem)              { this.stack.push('append'); }
    Visit_Strcpy(elem)              { this.stack.push('strcpy'); }
    Visit_Strcmp(elem)              { this.stack.push('strcmp'); }
    Visit_Strlen(elem)              { this.stack.push('strlen'); }
    Visit_Struct(elem)              { this.stack.push('struct'); }
    Visit_Printf(elem)              { this.stack.push(null); }
    Visit_Scanf(elem)               { this.stack.push(null); }
    Visit_Pow(elem)                 { this.stack.push(null); }
    Visit_Sqrt(elem)                { this.stack.push(null); }
    Visit_Round(elem)               { this.stack.push(null); }
    Visit_Floor(elem)               { this.stack.push(null); }
    Visit_Ceiling(elem)             { this.stack.push(null); }
    Visit_Sin(elem)                 { this.stack.push(null); }
    Visit_Cos(elem)                 { this.stack.push(null); }
    Visit_Intt(elem)                { this.stack.push('%d'); }
    Visit_Doublee(elem)             { this.stack.push('%f'); }
    Visit_Charr(elem)               { this.stack.push('%c'); }
    Visit_SqBracket1(elem)          { this.stack.push('['); }
    Visit_SqBracket2(elem)          { this.stack.push(']'); }
    Visit_Parenth1(elem)            { this.stack.push('('); }
    Visit_Parenth2(elem)            { this.stack.push(')'); }
    Visit_Bracket1(elem)            { this.stack.push('{'); }
    Visit_Bracket2(elem)            { this.stack.push('}'); }
    Visit_Dot(elem)                 { this.stack.push('.'); }
}