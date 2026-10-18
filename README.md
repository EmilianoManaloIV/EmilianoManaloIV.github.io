# emilianomanaloiv.github.io

The personal website of Emiliano Panday Manalo IV: **https://emilianomanaloiv.github.io**

This README is the owner's guide to running the site day to day. You never edit HTML to publish. R&D posts, projects, and the guestbook all come from this repository's [Discussions](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/discussions). The site rebuilds within about a minute of any change, from the web or the GitHub mobile app.

- [Publish an R&D post](#publish-an-rd-post)
- [Add a project](#add-a-project)
- [Skills on the About page](#skills-on-the-about-page)
- [The guestbook](#the-guestbook)
- [Edit, hide, or remove](#edit-hide-or-remove)
- [Moderate comments and signatures](#moderate-comments-and-signatures)
- [If something doesn't show up](#if-something-doesnt-show-up)

## Publish an R&D post

1. Open **Discussions** and click **New discussion**.
2. Pick the **R&D** category.
3. Write a title and the post. Markdown works: headings, lists, code blocks, links, and images you drag in.
4. Click **Start discussion**.

The post appears on the [R&D page](https://emilianomanaloiv.github.io/rd/), newest first, and gets its own page at `/rd/<number>-<title>/`. Visitors can comment on it with a GitHub account, and their comments show under the post.

The first paragraph is the summary on the R&D page and in link previews. Images are copied onto the site, so visitors never load anything from GitHub.

## Add a project

1. Open **Discussions** and click **New discussion**.
2. Pick the **Projects** category.
3. Use the project's name as the title.
4. If the project has a link, make it the **first line**, with nothing else on that line:

   ```
   Link: https://github.com/EmilianoManaloIV/blendity
   ```

   It becomes the orange "Blendity link" button. With no `Link:` line, there is no button.
5. Write the description. The first paragraph becomes the text on the home page card.
6. Drag in a screenshot or render. The first image becomes the card picture. Without one, the card shows a placeholder.
7. Click **Start discussion**.
8. In the right sidebar, open **Labels** and pick the project's skills. See the next section.

The project shows up in the home page's Projects section, newest first, with its own page at `/projects/<number>-<title>/` where visitors can comment.

## Skills on the About page

Skills are GitHub labels whose names start with `skill: `, for example `skill: C++` or `skill: Unity3D`.

- **On a project:** a skill label shows as a tag on the project's card and page.
- **On the About page:** the "From my projects" list shows every skill used by at least one project. Each skill has a count, and hovering over it names the projects that use it.
- **New skill:** create a label named `skill: <name>` from the Labels picker, or from **Issues → Labels → New label**. The skill labels use the color `#D9822B`.
- **Other labels** such as `bug` or `enhancement` never appear on the site.

Adding or removing a label rebuilds the site, so the About page stays in sync. A skill disappears from About once no project uses it, but the label stays in the repository for reuse.

Other skill groups on the About page, such as tools or languages, are still written by hand in `about/index.html`.

## The guestbook

The [guestbook](https://emilianomanaloiv.github.io/guestbook/) is an old-internet guest list.

- **Where it lives:** the **Sign The Guestbook** discussion ([#6](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/discussions/6)) in the **Guestbook** category. It is pinned, so it's easy to find.
- **Signing:** visitors click "Sign the guestbook" on the site, which opens that discussion, and leave a comment with their GitHub account.
- **On the site:** each comment becomes a numbered signature, oldest first (#001, #002, …), with the visitor's username and date. Replies to a signature are not shown.
- **Links and images:** visitors can include links and pictures. Links are marked so search engines don't follow them, and only images hosted on GitHub are kept.

Keep that one discussion. The site always uses your oldest discussion in the Guestbook category, so a new one wouldn't replace it, and deleting #6 would erase every signature.

## Edit, hide, or remove

These work the same for posts and projects.

| You want to… | Do this | On the site |
|---|---|---|
| Fix a typo or update content | Edit the discussion | The page updates. |
| Rename it | Edit the title | The address changes, and old links still work. |
| Take it down for now | Move it to another category, such as General | The page disappears. Moving it back restores it with its comments. |
| Remove it for good | Delete the discussion | The page, its card, and its skills disappear. **This is permanent on GitHub, comments included.** |

Only discussions you write in R&D or Projects become pages. Visitors can comment, but anything they start there never appears on the site.

After any change, browsers may show the old page for up to 10 minutes.

## Moderate comments and signatures

- **Delete a comment** to remove it from the site within a minute.
- **Hide a comment** to remove it within the hour. Hiding doesn't trigger a rebuild, so the hourly rebuild picks it up.
- **Lock a discussion** from its sidebar to stop new comments, for example a post you don't want discussed.

## If something doesn't show up

1. Open the [Actions tab](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/actions) and look at the latest run.
2. A failed run leaves the last good version of the site live. Open the failed step, and the log names the problem.
3. A common cause is a broken site link inside a post, such as `/no-such-page/`. Fix the link in the discussion and the site rebuilds.
4. To rebuild by hand, open the **Test and deploy** workflow and click **Run workflow**.

The hourly rebuild pauses after 60 days without any activity in the repository. Any post, comment, or manual run starts it again.

## For developers

How the site is built, tested, and changed is in [`CLAUDE.md`](CLAUDE.md) and the decision records in [`docs/decisions/`](docs/decisions/), especially [0005](docs/decisions/0005-discussions-as-content-built-in-ci.md) and [0006](docs/decisions/0006-projects-and-skills-from-discussions.md).
