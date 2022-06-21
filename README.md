# Distributed Loader
* Author: Xulin Zhou
* License: Apache 2

## 用途
这个项目主要用于解决现代化 Web 项目（Vue/React/Angular）中静态 CDN 依赖的可用性问题，如果一个资源仅仅依赖一个 CDN 源，则当这个 CDN 源不可用时你的资源就无法完成加载，导致网站白屏或无法正常运转

dist-loader 是使用了朴素的负载均衡思想，可以为一个静态资源配置一系列可用的 CDN 源，并可以指定超时时间，这样静态资源可以使用最先完成加载的 CDN 源，这样既提高了静态资源的 **可用性**（毕竟所有厂商 CDN 源同时挂掉的概览还是很小的），也提高了静态资源加载的 **期望速度**（每个资源都使用最先加载完成的源）


## 安装
```shell script
npm install dist-loader
```

## 用法
首先你需要在  npm 项目的 `package.json`  的同一目录中创建一个名为 `load.config.js` 的文件，其中声明加载配置，格式可以参考源码中的 `load.config.js` 

```js
module.exports = {  
    outputDir: 'dist',  
    indexPath: 'index.html',  
    devIndexPath: 'public/index.html',  
    appDirs: [...],  
    defaultConfig: {  
        timeout: 3000,  
        responseTimeout: 10000,  
        concurrency: 2,  
        random: true,  
    },  
    resources: [...]  
}
```
其中的属性有
`outputDir`：输出文件夹地址，一般来说对应于你的前端项目的静态文件输出地址
`indexPath`：生产的入口文件的地址，相对于 `outputDir` 
`devIndexPath`：开发的入口文件地址，相对于项目根目录
`appDirs`：需要被入口文件加载的 js / css 文件等，其中可以声明一系列输出文件夹中的子文件夹配置
* `path`：文件夹的相对路径，如 `js`，`css`
* `link`：是否通过  `<link rel="preload">`  方式加载，
* `load`：是否加载
* `independent`：是否独立，对于 css 文件来说，没有任何依赖或者被其他文件依赖，所以可以设为 true
* `defaultFiles`：默认文件，如 `['app.js', 'chunk-vendors.js']`

`defaultConfig` 每个资源的默认配置，`resources` 中的每个对象的对应属性如果没有定义就会使用这个对象中的该属性的值

`resources`：接受一个 Array, 每个对象元素可以定义的属性如下
* `name`: 资源的名称，用于声明 dependency
* `dependency`: 依赖名称的数组, 只有dependency 中的resource完成加载和执行才会执行此资源，一般用于有依赖的script

> **依赖执行**
> 由于 js 的执行有依赖关系，比如 vuex / vue-router 等的执行依赖于 vue 包的加载，而你的应用文件的执行需要依赖于大部分的 js 库，所以  `dependency` 提供了显式的依赖指定，dist-loader 在加载完成一个资源后，会解析它的依赖是否都加载并执行完成，如果执行完成才会执行这个资源，否则会等待其依赖资源加载执行完成后的反向搜索触发（你不能定义环形依赖）

* `urls`: 一系列 URL，通常可以是一个静态资源的一系列 CDN 地址
* `timeout`：请求超时时间，如果这么长时间后请求依然未得到响应，则终止此请求
* `responseTimeout`: 完成响应的超时时间，如果这么长时间后响应仍未完成下载，则终止此请求
* `random`: 随机加载urls中的资源（不按照固定顺序）
* `concurrency`: 加载urls中资源的并发数，默认为1，即一个URL没有得到结果（成功/失败/超时）时不会请求下一个，设置大于1的数量则会让数个URL请求并发，提高期望加载效率
* `load`：是否下载url中的内容，默认为true，如果为false则等待所有的依赖完成执行后执行（直接把url作为src）
* `link`: 是否将资源作为一个link元素插入，这个属性和load并不冲突，如果link=true, load=true, 则既会加载内容，也会通过 `<link rel="preload">` 等方式将下载成功的URL插入DOM，开启了缓存时，DOM会直接从disk cache中读出需要的内容，所以并不增加过多额外的加载时间 
* `appEssentials`：是否是加载应用代码所必须的，如果为 true，则这个资源将会自动添加到应用资源的依赖中


## 命令
dist-loader 库执行的命令是实现如下的作用：
解析你的配置文件并连同 dist-loader 中的实现代码一起（大约 9k）进行压缩后插入到你的入口文件（index.html） 中，这样客户端只要能够下载入口文件，就能够开始所有静态文件的请求

实现插入的命令有
```shell
dist-load dev
```
这个命令会把加载代码插入到 `devIndexPath` 参数指定的文件中

```shell
dist-load build
```
这个命令会把加载代码插入到 `indexPath` 参数指定的文件中（相对于 `outputDir`）

你可以在 npm 项目的 `package.json` 的 `scripts` 中加入以下命令来进行 shortcut
```json
{  
  "scripts": {  
    "load-dev": "dist-load dev",  
    "load-build": "dist-load build"  
  }
}
```


## 结合主流框架
### Vue
`vue.config.js` 需要禁用默认的HTML生成
```js
chainWebpack: config => {  
    config.plugins.delete('html')  
    config.plugins.delete('preload')  
    config.plugins.delete('prefetch')
}
```

