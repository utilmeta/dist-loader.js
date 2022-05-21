# Distributed Loader
author: zxl
package-name: dist-loader

## 用法
loadResources(:resources)
resources 接受一个 Array, 每个对象元素的属性
* `name`: 资源的名称，用于声明 dependency
* `dependency`: Array of dependency name, 只有dependency 中的resource完成加载和执行才会执行此资源，一般用于有依赖的script
* `urls`: 一系列 URL
* `timeout`：请求超时时间，如果这么长时间后请求依然未得到响应，则终止此请求
* `responseTimeout`: 完成响应的超时时间，如果这么长时间后响应仍未完成下载，则终止此请求
* `random`: 随机加载urls中的资源（不按照固定顺序）
* `concurrency`: 加载urls中资源的并发数，默认为1，即一个URL没有得到结果（成功/失败/超时）时不会请求下一个，设置大于1的数量则会让数个URL请求并发，提高期望加载效率
* `load`：是否下载url中的内容，默认为true，如果为false则等待所有的依赖完成执行后执行（直接把url作为src）
* `link`: 是否将资源作为一个link元素插入，这个属性和load并不冲突，如果link=true, load=true, 则既会加载内容，也会通过 `<link rel="preload">` 等方式将下载成功的URL插入DOM，开启了缓存时，DOM会直接从disk cache中读出需要的内容，所以并不增加过多额外的加载时间 

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

## TODO
1. 加载方式优化
由于本脚本就是用于加载其他依赖库的，所以这个脚本最好直接内嵌在 html 中立即加载，优化整体的加载时间

2. 与 webpack 等工作流的整合
目前 vue 等项目 build 直接产生的 js/css 等资源文件含有hashtag，这部分文件需要等待必要的资源加载完毕后才能执行，需要对生成的html作调整