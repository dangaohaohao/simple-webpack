const path = require('path');
const fs = require('fs');
const {
    getAST,
    getDependencies,
    transform
} = require('./parser');

module.exports = class Compiler {

    constructor(options) {
        const {
            entry,
            output
        } = options;
        this.entry = entry;
        this.output = output;
        this.modules = [];
    }

    run() {
        const entryModule = this.buildModule(this.entry, true);
        this.modules.push(entryModule);

        this.modules.map((_module) => {
            _module.dependencies.map((dependencies) => {
                this.modules.push(this.buildModule(dependencies));
            });
        });

        this.emitFiles();
    }

    buildModule(filename, isEntry) {
        let ast;
        // 是否是入口文件，入口文件是绝对路径，依赖的文件路径是相对的，得转成绝对路径
        if (isEntry) {
            ast = getAST(filename);
        } else {
            const absolutePath = path.join(process.cwd(), './src', filename);
            ast = getAST(absolutePath);
        }
        return {
            filename,
            dependencies: getDependencies(ast),
            source: transform(ast),
        }
    }

    emitFiles() {
        const outputPath = path.join(this.output.path, this.output.filename);

        let modules = '';

        // 按照 webpack 给每一个模块加一层包裹
        this.modules.map(_module => {
            modules += `'${_module.filename}': function(require, module, exports) {${_module.source}},`;
        });

        const bundle = `(function(modules) {
            function require(filename) {
                var fn = modules[filename];
                var module = {exports: {}};

                fn(require, module, module.exports)
                return module.exports;
            }
            require('${this.entry}');
        })({${modules}})`;

        fs.writeFileSync(outputPath, bundle, 'utf-8');
    }

}