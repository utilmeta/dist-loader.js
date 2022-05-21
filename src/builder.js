#! /usr/bin/env node
const UglifyJS = require("uglify-js");
const htmlMinify = require("html-minifier");
const argv = process.argv.slice(2);
const cmd = argv[0];
const fs = require('fs');
const path = require('path');
const initDir = process.env.INIT_CWD || process.cwd();

function getCurrentPackageDir(dir=initDir) {
    if(fs.existsSync(path.join(dir, 'package.json'))){
        return dir;
    }
    try {
        return getCurrentPackageDir(path.basename(dir))
    }catch (e) {
        return ''
    }
}

function minStringify(obj) {
    if(typeof obj === 'string'){
        return `'${obj}'`
    }
    else if(Array.isArray(obj)){
        let items = [];
        for(let val of obj){
            items.push(minStringify(val))
        }
        return `[${items.join(',')}]`
    }
    else if(obj && typeof obj === 'object'){
        let items = [];
        for(let key in obj){
            if(!obj.hasOwnProperty(key)){
                continue
            }
            items.push(`${key}:${minStringify(obj[key])}`);
        }
        return `{${items.join(',')}}`
    }
    return String(obj)
}
function pathJoin(base, url, prependSlash=false){
    if(url.startsWith('http://')||url.startsWith('https://')){
        return url;
    }
    let path;
    if(!url){
        path = base;
    }
    else if(!base){
        path = url;
    }else{
        if(!base.endsWith('/')){
            base = base + '/'
        }
        if(url.startsWith('/')){
            url = url.substring(1)
        }
        path = base + url;
    }
    if(path.startsWith('http://')||path.startsWith('https://')){
        return path;
    }
    if(prependSlash && !path.startsWith('/')){
        path = '/' + path;
    }
    return path
}

function buildFiles(dev=false) {
    process.env.NODE_ENV = dev ? 'debug' : 'production';
    const packageDir = getCurrentPackageDir();
    if(!packageDir){
        throw 'no package found in current directory'
    }
    const configPath = path.join(packageDir, 'load.config.js');
    if(!fs.existsSync(configPath)){
        throw `no load.config.js found in current package directory: ${packageDir}`
    }
    let config = require(configPath);
    let resources = config.resources;
    if(!resources || !Array.isArray(resources)){
        throw `invalid resources: ${resources}`
    }
    const outputDir = path.join(packageDir, config.outputDir || 'dist');
    if(!fs.existsSync(outputDir)){
        throw `outputDir: ${outputDir} not exists`
    }
    const devIndexPath = path.join(packageDir, config.devIndexPath || 'index.html')
    const indexPath = dev ? devIndexPath : path.join(outputDir, config.indexPath || 'index.html');
    let indexContent
    if(!fs.existsSync(indexPath)){
        if(dev){
            throw `indexPath: ${indexPath} not exists`
        }else{
            if(!fs.existsSync(devIndexPath)){
                throw `devIndexPath: ${devIndexPath} not exists`
            }
            indexContent = String(fs.readFileSync(devIndexPath, {encoding:'utf8', flag:'r'}));
        }
    }else{
        indexContent = String(fs.readFileSync(indexPath, {encoding:'utf8', flag:'r'}));
    }
    let appDependencies = [];
    for(let src of resources){
        if(src.appEssentials){
            appDependencies.push(src.name);
            delete src.appEssentials;     // redundant attribute in build file
        }
    }
    if(config.appDirs){
        for(let dirObj of config.appDirs){
            if(dev){
                (dirObj.defaultFiles || []).forEach(file=>{
                    let ref = pathJoin(dirObj.path, file, true);
                    resources.push({
                        name: ref,
                        dependency: dirObj.independent ? [] : appDependencies,
                        link: dirObj.link,
                        load: dirObj.load,
                        urls: ref,
                    });
                })
                continue
            }
            let appDir = path.join(outputDir, dirObj.path);
            fs.readdirSync(appDir).forEach(file => {
                let filePath = path.join(appDir, file);
                if(fs.lstatSync(filePath).isDirectory()){
                    return
                }
                let ref = pathJoin(dirObj.path, file, true);
                resources.push({
                    name: ref,
                    dependency: dirObj.independent ? [] : appDependencies,
                    link: dirObj.link,
                    load: dirObj.load,
                    urls: ref,
                });
            });
        }
    }
    let re = /<script id="loader-script">([\s\S]*?)<\/script>/gm;
    let re2 = /<script id=loader-script>([\s\S]*?)<\/script>/gm;
    let execRegex = re.exec(indexContent) || re2.exec(indexContent);
    let begPart
    let endPart
    if(execRegex){
        // already setup
        begPart = indexContent.substr(0, execRegex.index)
        endPart = indexContent.substr(execRegex.index + execRegex[0].length);
    }else{
        let autoIndex = indexContent.indexOf('</title>');
        if(autoIndex === -1){
            throw 'html title is require for auto load'
        }
        autoIndex += '</title>'.length;
        begPart = indexContent.substr(0, autoIndex)
        endPart = indexContent.substr(autoIndex);
    }
    const loaderPath = path.join(__dirname, 'loader.js');
    const loaderContent = String(fs.readFileSync(loaderPath, {encoding:'utf8', flag:'r'}));
    const appendScript = `${loaderContent}loadResources(${minStringify(resources)},${minStringify(config.defaultConfig||{})})`;
    const minifiedScript = UglifyJS.minify(appendScript);
    if(minifiedScript.error){
        throw `minify script failed with error: ${minifiedScript.error}`
    }
    const scriptContent = `<script id="loader-script">${minifiedScript.code}</script>`
    let buildContent = `${begPart}${scriptContent}${endPart}`;
    if(!dev){
        buildContent = htmlMinify.minify(buildContent, {
            removeRedundantAttributes: true,
            removeComments: true,
            collapseBooleanAttributes: true,
            collapseWhitespace: true,
        });
    }
    fs.writeFileSync(indexPath, buildContent);
    console.log(`index file built at ${indexPath}`)
}

if(cmd === 'build' || cmd === 'dev'){
    buildFiles(cmd === 'dev')
}