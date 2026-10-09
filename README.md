# jat001.com

个人主页。**只有一屏**：左边是名字和联系方式，右边是由语言图标组成的旋转球体。
支持浅色和深色。

## 技术栈

| 层   | 选择                                                                     |
| ---- | ------------------------------------------------------------------------ |
| 构建 | Astro 7 静态输出——线上**除了它的产物，只有三段协商 `Accept` 的边缘代码** |
| 3D   | 手动投影的 DOM 元素，不用 WebGL，也不用 3D 库                            |
| 样式 | Astro 作用域 CSS + 自定义属性 token（`src/styles/global.css`）           |
| 字体 | Astro `fonts` API，经 Fontsource 自托管并子集化                          |

`devicon` 和 `simple-icons` 只有生成脚本会读；图标路径在构建时内联，
所以两个库都不会进入浏览器。

依赖怎么分，看的是什么会被部署，而不是 npm 发布包意义上的“运行时”：`astro`、
它的集成和两个图标库都会往 `dist/` 里放东西，`negotiator` 会进入 Worker、
边缘函数和 proxy，所以它们是 `dependencies`。`typescript`、`@types/node`、
`@types/negotiator` 和 `@astrojs/check` 只用来检查——Astro 用 esbuild 去掉类型，
从不用 tsc——所以它们是 `devDependencies`，Astro 文档站和 Next.js 的 TypeScript
示例也是这么放的。

`Accept` 交给 `negotiator` 协商，它是 Express `req.accepts()` 背后的解析器，
没有用正则去匹配：它会考虑 `q` 和具体程度，`q` 相同时按客户端列出的顺序决定。

由此带来一点：`pnpm build` 会先跑 `astro check`，所以需要完整安装依赖。
四个平台都不会只装生产依赖。

## 命令

```sh
pnpm dev               # 重新生成语言列表，然后启动开发服务器
pnpm check             # 重新生成语言列表，然后 astro check
pnpm build             # check，然后 astro build
pnpm preview           # build，然后预览 dist/
pnpm build:languages   # src/data/languages.ts 超过 12 小时才重新生成
```

`src/data/languages.ts` 是生成的，已加入 gitignore。`dev`、`check`、`build` 和
`preview` 都会刷新它，但只在磁盘上那份**超过 12
小时**时才刷新——时间取自文件头里的 `Generated:` 时间戳，而不是文件的 mtime，
因为 checkout 会重置 mtime。所以一个工作目录大约一天访问两次 WakaTime，
想立刻刷新就加 `--force`。全新 clone 下来没有这份文件，必须访问 WakaTime；
访问不了时脚本会抛错、构建失败，而不是发布一份过时的列表。

配置里设置了 `server.host`，所以 `dev` 和 `preview` 都监听所有网络接口，
同一网络下的手机也能打开。

> 运行 `pnpm build` 之前先停掉正在运行的服务器。在 Windows 上它会占用
> `dist/.prerender`，构建会在清理时以 `EBUSY` 失败。

## 目录结构

```
src/
  components/   Hero（左）、Sphere（右）、ThemeToggle、Footer
  data/         profile.ts — 全部文案；languages.ts — 生成的
  layouts/      Base.astro — head、meta、字体、防闪烁的主题脚本
  lib/          markdown.ts — 页面的 Markdown 副本在哪、谁要它
  pages/        index.astro — 页面本身；404.astro；index.md.ts
  scripts/      sphere.ts — 3D 部分，动态导入
  styles/       global.css — 两套主题的 token
scripts/
  build-languages.mjs   WakaTime + 图标 -> src/data/languages.ts
  ignore-build.sh       Vercel、Netlify：推送没碰到自己的文件就跳过构建
worker/
  index.ts      仅 Cloudflare：协商 Accept，以及真正返回 404 状态的 404
netlify/
  edge-functions/
    index.ts    仅 Netlify：协商 Accept；404 靠重定向规则
vercel/
  index.ts      仅 Vercel：协商 Accept；404 靠一条路由
```

`profile.ts` 之外的文案只有界面文字：两个写死的 `aria-label`，以及 404
页面上的三行字。

## 球体

图标分布在一个斐波那契球面上。每一帧都把这些点旋转、做透视除法投影，
再把结果写成普通的 2D `transform`——所以图标始终是普通的 DOM 元素：

- 任意缩放都是矢量清晰的，屏幕阅读器也能读到
- 它们继承 `currentColor`，切换主题没有任何开销
- 脚本运行之前，它们是一组居中排列、带标签的图标，所以页面从不空白，也不需要 JS
  就能阅读

空闲时缓慢转动，拖动可以让它旋转。动画循环**只**在球体出现在屏幕上、
且标签页可见时运行，元素还会监听自己的尺寸，所以在 960px 以下——CSS
把它隐藏了——这段代码根本不会被加载。

图标不是链接。全部 34 个都会指向同一个 URL，为了到达一个目的地，要付出 34 个
Tab 停留点，以及屏幕阅读器链接列表里 34 条相同的条目；WakaTime
改放在联系方式那一行。悬停是逐个元素的状态，
所以每个图标仍然会单独高亮——这从来不依赖链接。

## 语言列表

`src/data/languages.ts` 是生成的。一项要同时满足两个条件才会出现：

1. 在 WakaTime 上累计超过一小时，并且
2. devicon 或 simple-icons 里有它的图标。

没有任何手写的列表。`scripts/build-languages.mjs` 顶部有五处调整：

| 常量            | 原因                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `MIN_SECONDS`   | 只要打开过文件，WakaTime 就会记上几秒                                |
| `MAX_AGE_HOURS` | 生成的列表多久之内算作最新                                           |
| `ALIAS`         | `Vue`/`Vue.js`、`HTML`/`HTML5` 是同一个东西；POSIX shell 都并入 Bash |
| `EXCLUDE`       | `Xorg`、`TeX`                                                        |
| `ICON_OVERRIDE` | `SQL`——见下文                                                        |

生成脚本会打印保留了什么、丢掉了什么，所以每次运行都能看清哪些项超过了一小时，
却哪里都没有图标。

### 图标

两个库单独都覆盖不全，所以两个都用，并去掉它们写死的 `fill` 属性，
让所有图标都用 `currentColor` 着色。优先级是 devicon `plain` → simple-icons →
devicon `line`/`original`，彩色版本排在最后：给它们着色会丢掉别人选好的颜色。

`devicon.json` 有遗漏——有些图标带了它没列出的 `plain`
文件——所以生成脚本放弃之前会先查一下磁盘。

**两个库里都没有 SQL 这门语言的标志**——只有产品（MySQL、PostgreSQL、SQL
Server……）。`ICON_OVERRIDE` 把它指向 devicon 的 `azuresqldatabase`，
这是其中最中性的一个。

许可：devicon 为 MIT，simple-icons 为 CC0-1.0。各标志仍是其所有者的商标。

## 主题

浅色是基础，深色用同一套 token 名镜像过来：

```
:root                            -> 浅色
prefers dark + not forced light  -> 深色
[data-theme="dark"]              -> 深色，强制
```

媒体查询只问是否偏好深色，从不问浅色，
所以根本不报告偏好的浏览器什么也匹配不到，保持基础的浅色。同样的原因，
强制浅色也不需要单独的规则。

`localStorage` 只读一次，由 `<head>` 里的内联脚本读取，
它在首次绘制之前应用已保存的选择，所以刷新时不会闪出另一个主题。
它只在一个地方写入——点击切换按钮时——而且每次点击都会写入。
因此点一次就固定了主题：在清除这个键之前，页面不再跟随系统。

## 布局

一个网格，两列，960px 以下收成一列——这时球体直接去掉而不是缩小，
好让页面仍然只有一屏。

`body` 是高 `100svh` 的纵向 flex，`main` 占满剩余空间，
页脚在正常文档流里跟在后面。在足够高的屏幕上，这样页脚正好落在屏幕底边，
不需要滚动；在横屏手机上，内容大约需要 500px，高度却只有 390px，页面会滚动，
页脚在内容末尾，而不是浮在内容上面。

联系方式那一行固定为两列，没有用 `auto-fit`：这么宽的列里，
四个联系方式会一行排三个，把第四个单独剩在下一行。

从 960px 起，左列上移 30px。它和球体最终的高度相差不到 25px，但在同一条中线上，
带边框的面板放在一团大部分是空白的图标旁边，看起来更重。
比这更窄时没有球体需要平衡，高度不足 700px 时也没有上移的余地，
所以这条规则同时限定了两者。

球体要的是一个上限为 `74svh` 的正方形，保证它在一屏之内，
然后被拉伸到整行的高度，所以它从不比文字列矮。一旦窗口矮到放不下那一列，
页面反正要滚动，球体再小只会损失平衡。在 1280px 宽、500px 高的窗口里，
舞台原来是 370px，旁边的列是 529px；高 360px 时只有 266px，半径卡在脚本的 120px
下限上，图标溢出了舞台。现在两种情况都填满了那一列。高度在 717px 以上时，
`74svh` 在任何宽度下都已经超过那一列，所以那里没有变化。上限放在一个 `::before`
占位元素上，因为在舞台上设 `max-height` 也会限制拉伸；而 `main`
让它的行居中而不是拉伸，否则舞台会拿到整个屏幕。

左列上限为 `30rem`。960px 以下球体没了，也没有别的东西占宽度，没有上限的话，
联系方式的格子会达到 431px——几乎是桌面上的两倍。两列布局里这一列最多 468px，
所以这个上限只在两列收起之后才起作用。

名字和标语用 `cqw` 定大小，以列为基准而不是视口。列在 `30rem` 封顶之后，
视口就不能再代表它：用 `14vw` 时，名字在 540px 时占列宽的 22%，在 1600px 时占
67%，现在则始终保持在 65–67%。`.intro` 带 `container-type`
只是为了这个——没有任何规则查询它。

404 页面也是同样的规则。它的 `main` 上限是
`min(100%, calc(30rem + 2 * var(--gut)))`，这样上限落在内容盒而不是边框盒上，
大号的 404 是 `46cqw`。它原来也有同样的割裂：从 480px 到 1200px
一直是容器宽度的 27%，容器在 1072px 封顶而 `14vw` 继续增长后变成 36%，最窄处
`64px` 的下限把字号固定住、容器却还在缩小，变成 40%。

堆叠用的是 480px 的**媒体查询**，不是容器查询。
容器查询区分不了真正要区分的两种情况，因为它们的范围重叠：手机上的列是
288–432px，球体旁边的列是 374–468px。所以 400px 的阈值会让视口在 960px 到
1026px 之间时堆叠——这段之外一行两个，这段之内一行一个。
当初写容器查询要解决的拥挤也已经不存在了：它是在三个格子需要 407px 时校准的，
现在两个格子只需要 272px，而这一列最窄是 374px。

两列是 `29fr` 和 `35fr`——464px 和 560px，
也就是外框占满时的分配——所以在任何宽度下，球体都是更宽的那一列。
之前两种做法都做不到。用纯 `vw` 时，外框封顶之后球体还在变宽，
代价落在文字列上：视口 1200px 时它有 552px，1920px 时只有 448px，
于是联系方式的格子在更小的屏幕上反而*更宽*。在外框封顶处达到 `35rem`
的渐变修好了那一头，但起点必须很低，在两列原来分开的 901px 处，球体只有 381px，
文字有 394px。固定比例在现在分列的 960px 处给球体 452px、文字 374px，1280px
以上则和之前一样是 464px 和 560px。

## 部署

`pnpm build` 输出静态的 `dist/`，有四个目标接在它后面。它们构建的是同样的产物，
所以任何一个都能单独承载整个站点。

**Cloudflare Workers。** `wrangler.jsonc` 从边缘提供 `dist/`，并在
`run_worker_first` 里列出少数几个改由 `worker/index.ts` 处理的路径。
不在列表里的——CSS、字体、图标——从不唤醒它。`/` 在 Worker 里协商 `Accept`；
`/404`、`/404/` 和 `/404.html` 由 Worker 直接以 404 状态返回 404 页面，`/404/`
因此不会先被去掉末尾斜杠的规则 307 到 `/404`。Worker 自己声明它读取的唯一绑定
`ASSETS`，没有用 `wrangler types` 生成的 `Env`：wrangler 不是这里的依赖，
另外三个平台的构建镜像也都没有它，所以 `astro check` 在每个平台上都检查
Worker，而 Workers Builds 自己编译它。在控制台的 Workers & Pages → 这个 Worker
→ Settings → Builds 里关联仓库。这走的是 Cloudflare 的 GitHub App，
所以仓库里不存任何东西，也不涉及 API token。构建设置在控制台里，不在
`wrangler.jsonc` 里，Workers Builds 不从那里读构建设置：

| 设置                        | 值                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Build command               | `pnpm install && pnpm run build`                                                                                                             |
| Deploy command              | `pnpx wrangler deploy`                                                                                                                       |
| Build watch paths — include | `*`                                                                                                                                          |
| Build watch paths — exclude | `.github/*, .vscode/*, .gitignore, README.md, AGENTS.md, CLAUDE.md, vercel.json, vercel/*, netlify.toml, netlify/*, scripts/ignore-build.sh` |
| Build variables             | `PNPM_VERSION = 12`, `SKIP_DEPENDENCY_INSTALL = 1`                                                                                           |

这两个构建变量取代了镜像本来会自己执行的安装，也就是用镜像自带的 pnpm 运行
`pnpm install --frozen-lockfile`。那个 pnpm 默认是 10，而 pnpm 12 的 lockfile
是两个 YAML 文档——第一个指明要用的 pnpm，第二个是项目本身——10 会直接以
`ERR_PNPM_BROKEN_LOCKFILE` 拒绝。`SKIP_DEPENDENCY_INSTALL` 把安装交给构建命令，
它跑的是和 Vercel `installCommand` 一样的 `pnpm install`；`PNPM_VERSION`
只写主版本号：确切版本是 lockfile 里固定的那个，pnpm 会自己读取并切换过去。

监视路径与 Pages 工作流里的 `paths-ignore`、以及 Vercel 和 Netlify 都会运行的
`scripts/ignore-build.sh` 里的列表相对应，但这三处没有两处写法相同。Cloudflare
的 `*` 能匹配 `/`，GitHub 的不能，所以这里写 `*.md` 会匹配整棵树里的每个
Markdown 文件，而不只是根目录那三个——包括将来可能出现在 `src/` 下的内容，
它们就再也不会触发部署了。

没法把它限定在根目录。`/*.md` 有两处不行：通配符只能放在规则的开头或结尾，
不能夹在 `/` 和 `.md` 之间；而且被匹配的路径是相对于仓库的，开头没有斜杠，
文档自己的 `docs/README.md` 示例就是这样。这些规则源自分支过滤——`fix/*` 匹配
`fix/bugs`——根本没有路径边界的概念。所以根目录的文档只能逐个列出，
新增一个就得手动加上。漏掉的代价最多是多一次构建。

排除规则先应用，剩下的路径再和包含规则匹配，所以 `*`
加上这份排除列表的意思是“除非这次推送只碰了这些文件，否则就构建”。一次推送有 20
个以上提交或 3000 个以上文件时，会跳过这项检查，直接构建。

`not_found_handling` 把没匹配到的路径指向 `404.html`，并返回真正的 404；Pages、
Vercel 和 Netlify 也都会自己以 404 状态返回这个文件，
所以哪一个都不需要为此加重定向。在本地 checkout 里运行 `wrangler deploy`
也可以，用于手动发布。

> **页面要有缓存规则才能被缓存。** 在一条条件覆盖你所用主机名的缓存规则里打开
> **Respect Strong ETags**。没有它，任何在边缘改写 HTML
> 的功能都会留下一个无法声明长度的响应体，于是响应以 `chunked` 发出，没有
> `Content-Length`，也没有 `ETag`，页面就无法重新验证。
>
> 打开这条规则后，页面会按构建时的字节原样返回，`If-None-Match`
> 会得到空响应体的 `304`。Markdown、图片和纯文本从不受影响，
> 因为它们不会被改写——正因如此，这个问题有一阵子看起来像是 HTML
> 本身没办法解决的事。规则要限定到主机名而不是路径：
> 只覆盖一个文件的规则只能修好那一个文件。缓存规则按 zone 生效，所以
> `*.workers.dev` 主机名没法设置。

**GitHub Pages。** `.github/workflows/pages.yml` 在推送到 `main` 时构建，
把产物交给 `actions/deploy-pages`。在仓库设置里把 Pages 来源设为 “GitHub
Actions”。当一次推送只改动了 `worker/`、`wrangler.jsonc`、`vercel.json`、
`vercel/`、`netlify.toml`、`netlify/`、`scripts/ignore-build.sh`、`.vscode/`、
`.gitignore` 或根目录的 `*.md` 时，`paths-ignore` 会跳过这次运行，
这些都不会进入这里的构建——用忽略列表而不是允许列表，
因为漏掉一个构建输入会让站点悄无声息地过时，而漏掉一个无关文件只是多跑一次。
其中的 TypeScript——`worker/index.ts`、`vercel/index.ts` 和边缘函数——确实会进入
`astro check`，但每个文件也会触发它所属平台的构建，类型错误会先在那里被拦下。
`.gitattributes` 特意没放进列表：它决定 checkout 的换行符，
所以可能改变被构建的字节。

**Vercel。** `vercel.json` 包含一切，
构建设置也在内——文件里的设置会覆盖控制台的。用 JSON 而不是 TOML 或 TypeScript
形式，是因为 CLI 会在构建前编译后两者，并为此自己跑一次安装，
而这次安装配置管不了，因为那时配置还没被读取。编译也没有任何好处：`vercel.ts`
只在构建时运行一次，导出的内容会被序列化成同样的静态 JSON，
所以它的代码不会碰到任何请求。

`framework` 是 `null`。文档规定，会自己生成路由中间件的框架不能用 `proxy`，
Astro 就在其中，而静态构建什么中间件也不会生成；Astro 预设会提供的每项设置，
这里都已经写明了。`/_astro/` 上为期一年的 `immutable` 没有预设也照样保留：
`framework: null` 的部署照样这样返回这些文件，所以它来自平台，而不是预设。
唯一的那条路由让 `/404` 返回 404。

`/` 归 `proxy`（Routing Middleware）处理，入口是 `vercel/index.ts`：
`wantsMarkdown` 判定需要时它返回 `index.md`，两种响应都带 `Vary: Accept`；
其他方法一律返回 405，和 Worker、边缘函数一样，而 Vercel 自己会给 `OPTIONS`
返回 204。它自己设置 `x-middleware-rewrite` 或 `x-middleware-next`，
`@vercel/functions` 的 `rewrite()` 和 `next()` 也只做这些，
所以不需要依赖这个包。`Vary` 放在 proxy 返回的响应上；如果用那两个辅助函数的
`request.headers`，反而会替换掉往后发送的请求的全部请求头。
两个辅助函数都不发起请求：rewrite 发生在 proxy 返回之后，
所以它看不到副本的响应，也不需要看到，`/index.md` 本来就是构建产物。按文档，
`proxy` 入口跑在 Node 上。在本地构建时，Node 函数带的是编译后原样的文件，
而不是打包结果，所以导入写的是 `markdown.js`，也就是那时实际存在的文件。
`cleanUrls` 用 308 把 `/index.html` 和 `/404.html` 重定向到对应的干净路径，
`trailingSlash: false` 对 `/404/` 也这样做。HTML 不用缓存规则也保留 `ETag`，
`If-None-Match` 会得到 `304`。

`ignoreCommand` 运行 `scripts/ignore-build.sh`，Netlify 的 `ignore` 也运行它。
脚本靠 `VERCEL` 和 `NETLIFY` 区分平台，并打印表示两个提交的变量，不论是否设置，
好让构建日志显示每种部署提供了哪些。退出码 0 跳过构建，1 进行构建。在 Vercel
上，它比较的是 `VERCEL_GIT_COMMIT_SHA`（正在构建的提交）和
`VERCEL_GIT_PREVIOUS_SHA`（上一次成功部署的提交），而不是指南里的 `HEAD^`，
后者只看一次推送的最后一个提交：先改 `src/` 再修 README 的推送就会被跳过。除非
diff 干净地表明只改了被忽略的文件，否则都会构建——没有上一次部署、
上一次部署的提交已经不在深度为 10 的 clone 里，这些情况都算。
重新部署不受脚本影响。在 Redeploy 对话框里勾选 “Use project's Ignore Build
Step” 时脚本会运行，两个 SHA 都是被重新部署的提交，但退出码会被忽略；
不勾选时脚本不运行。pathspec 用的是 git 的，它的 `*` 和 Cloudflare 的一样会跨越
`/`，但这里能表达根目录：在 `:(glob)` 下 `*` 止于 `/`，所以 `*.md`
只表示根目录的文档。

**Netlify。** `netlify.toml` 是 Netlify 唯一读取的配置格式，
里面有构建和开发命令、发布目录、ignore 命令和 Pretty URLs。`/index.html`
用强制的 301 跳到 `/`：Pretty URLs 会让它以 200 返回一份 `/` 的副本，而
Cloudflare 和 Vercel 都会重定向它。`/404` 和 `/404.html` 通过两条带 404
状态的重写返回 404，之所以强制，是因为这两个路径上本来就有文件，
不强制的话文件会盖过规则。`/` 是唯一需要代码的路径，即同一文件里声明的
`netlify/edge-functions/index.ts`，因为重定向规则能匹配国家、语言、角色、cookie
或查询参数，却匹配不了其他请求头。它从 `src/lib/markdown.ts` 取 `Accept`
判断和副本路径规则，导入时写明 `.ts` 扩展名，Deno
的打包器对相对路径要求这样写。副本以一个新的 `Request` 交给 `context.next()`，
并把原请求作为它的 init：`sendConditionalRequest` 只是让 Netlify
不去掉传给它的那个请求上的条件请求头，而一个全新的 `Request` 根本没有这些头。

`ignore` 运行同一个脚本，在 Netlify 上比较的是 `CACHED_COMMIT_REF` 和
`COMMIT_REF`，排除的是 Vercel 的文件而不是 Netlify 的。两个 ref 相同时构建：
文档说，没有缓存的构建会把自己的提交作为 `CACHED_COMMIT_REF`，
所以没有更早的提交可比。重新部署根本不运行脚本，尽管日志里仍会提到自定义 ignore
命令，然后直接开始安装。

四个平台都假设站点位于域名的根路径：`astro.config.ts` 设置了 `site`，
并且特意没有设置 `base`。如果从子路径提供服务，比如默认的
`jat001.github.io/jat001.com`，就需要设置 `base`，并相应修改 `profile.ts`
里以根开头的绝对路径。域名在各个平台上配置——仓库里没有 `public/CNAME`。

四个平台的构建都会访问 WakaTime，所以 WakaTime 故障时部署会失败，
而不是发布一份过时的列表。
