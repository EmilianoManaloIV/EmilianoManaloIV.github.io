# Owner's manual

How to run the site day to day: site text, posts, projects, clips, skills, the guestbook, moderation, and the conference card. You never edit HTML to publish. R&D posts, projects, and the guestbook all come from this repository's [Discussions](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/discussions), and the site rebuilds within about a minute of any change, from the web or the GitHub mobile app.

For how the site was made and how it works inside, see the [README](../README.md).

- [Edit your site text](#edit-your-site-text)
- [At the conference: your QR card](#at-the-conference-your-qr-card)
- [Link previews and home-screen icon](#link-previews-and-home-screen-icon)
- [Publish an R&D post](#publish-an-rd-post)
- [Add a project](#add-a-project)
- [Add a video clip](#add-a-video-clip)
- [Skills on the About page](#skills-on-the-about-page)
- [The AI-use note](#the-ai-use-note)
- [The guestbook](#the-guestbook)
- [Edit, hide, or remove](#edit-hide-or-remove)
- [Moderate comments and signatures](#moderate-comments-and-signatures)
- [If something doesn't show up](#if-something-doesnt-show-up)

## Edit your site text

Your bio, values, education, experience, email, and social links all live in one file: [`site-text.md`](../site-text.md).

**From a phone or a computer:**

1. Open [`site-text.md`](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/blob/main/site-text.md) on GitHub.
2. Tap the **pencil** (Edit) button.
3. Change the text under any `## Heading`. Keep the heading lines as they are.
4. Tap **Commit changes**, then **Commit changes** again.

The site updates in about a minute.

`main` is protected, so code changes arrive by pull request with passing tests. As the repository's
administrator you can still commit `site-text.md` edits straight to `main` this way: if GitHub offers
**Commit directly to the `main` branch** with a note about bypassing rules, that's expected. The build
checks the file before deploying.

**Tips:**
- **Formatting:** `*italic*`, `**bold**`, and `[link text](https://example.com)` work. Most sections are a single paragraph. **About story** can have several, with a blank line between them. Bullet lists aren't supported.
- **Education and Experience:** each entry is a `### When | Title` line, such as `### 2023–2027 | B.S. Computer Science`, followed by a sentence or two. Add or remove entries, keeping at least one in each.
- **Projects intro:** the sentence under the heading of your Projects page (`/projects/`).
- **Links:** leave a social link empty, with nothing after the colon, to hide it everywhere. Email is required.
- **If a change doesn't appear:** a mistake stops the update and your site stays as it was. Open the [Actions tab](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/actions), and the failed run says what to fix: a missing, duplicated, or misspelled heading, a bad link, or an extra paragraph. Fix it soon, because new posts, comments, and signatures also wait until the file is valid.

## At the conference: your QR card

Open **[emilianomanaloiv.github.io/card](https://emilianomanaloiv.github.io/card/)** on your phone. The footer of every page links to it as "Show my QR card".

- **Hold it up:** the QR code fills the screen and scans in light or dark mode. Turn your screen brightness up.
- **Print it:** print the page and you get a 4 × 3 in badge insert with the code, your name, and your title.
- **Stickers and slides:** download the code itself from the link on the card page, or use `/card/qr.svg`. It's a sharp SVG that scales to any size.

**Test it before you print:** scan the code from the card page with your phone's camera. It should open your site.

## Link previews and home-screen icon

Two optional images make the site look finished when it's shared or saved. Export them from the Figma file and add them to `assets/img/` on GitHub with **Add file → Upload files**.

| File | Size | What it does |
|---|---|---|
| `assets/img/share.png` | 1200 × 630 | The preview picture when your link is shared in chats and on social media |
| `assets/img/apple-touch-icon.png` | 180 × 180 | The icon when someone adds your site to an iPhone home screen |

The site picks them up on the next build. You don't need to change any code.

## Publish an R&D post

1. Open **Discussions** and click **New discussion**.
2. Pick the **R&D** category.
3. Write a title and the post. Markdown works: headings, lists, code blocks, links, and images or [video clips](#add-a-video-clip) you drag in.
4. Click **Start discussion**.

The post appears on the [R&D page](https://emilianomanaloiv.github.io/rd/), newest first, and gets its own page at `/rd/<number>-<title>/`. Visitors can comment on it with a GitHub account, and their comments show under the post.

The first paragraph is the summary on the R&D page and in link previews. Images and clips are copied onto the site, so visitors never load anything from GitHub.

### Mark a post as opinion

For posts that argue a view, rants included, open the discussion and pick the **`opinion`** label in the right sidebar. The post and its R&D card show a small **Opinion** tag within a minute. Remove the label to take the tag off.

## Add a project

1. Open **Discussions** and click **New discussion**.
2. Pick the **Projects** category.
3. Use the project's name as the title.
4. If the project has a link, make it the **first line**, with nothing else on that line:

   ```
   Link: https://github.com/EmilianoManaloIV/blendity
   ```

   It becomes the orange "Blendity link" button. With no `Link:` line, there is no button.
5. Write the description. The first paragraph becomes the text on the project's card.
6. Drag in a screenshot or render. The first image becomes the card picture. With no image, the first [video clip](#add-a-video-clip) is used instead, and with neither, the card shows a placeholder.
7. Click **Start discussion**.
8. In the right sidebar, open **Labels** and pick the project's skills. See the next section.

The project shows up on your [Projects page](https://emilianomanaloiv.github.io/projects/), newest first, with its own page at `/projects/<number>-<title>/` where visitors can comment. The home page previews your two newest projects and links to the Projects page for the rest.

## Add a video clip

Use a short clip instead of a GIF in a post or a project. A clip is much smaller than the same GIF, and it pauses with the site's motion button.

1. Name the file for what it shows, for example `orbit-demo.mp4`. Screen readers read the name as the clip's label ("orbit demo"). A camera name such as `IMG_9408.MOV` becomes just "Video clip".
2. Keep it short and small: under **10 MB**, ideally under **4 MB**, since visitors are often on conference Wi-Fi. Sound is muted on the site.
3. Drag the file into the discussion, the same way as an image.

On the site, the clip plays silently on a loop while it is on screen and motion is on. It pauses when a visitor turns motion off, and stays paused for visitors who asked their device for reduced motion. They can still press play.

**Use MP4 (H.264) or WebM.** iPhones often record in HEVC, which many browsers can't play, so the site drops those clips. To fix one, export it again as H.264: on iPhone, set **Settings → Camera → Formats** to **Most Compatible** before recording, or export from Photos or your editor as H.264 MP4. A dropped clip is named in the warnings of the latest [Actions](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/actions) run.

Visitors can't add clips: videos in comments and guestbook signatures never appear.

## Skills on the About page

Skills are GitHub labels whose names start with `skill: `, for example `skill: C++` or `skill: Unity3D`.

- **On a project:** a skill label shows as a tag on the project's card and page.
- **On the About page:** the "From my projects" list shows every skill used by at least one project. Each skill has a count, and hovering over it names the projects that use it.
- **New skill:** create a label named `skill: <name>` from the Labels picker, or from **Issues → Labels → New label**. The skill labels use the color `#D9822B`.
- **Other labels** such as `bug` or `enhancement` never appear on the site.

Adding or removing a label rebuilds the site, so the About page stays in sync. A skill disappears from About once no project uses it, but the label stays in the repository for reuse.

Other skill groups on the About page, such as tools or languages, are still written by hand in `about/index.html`.

## The AI-use note

Every page's footer says "Built with AI assistance" and links to **How this site was made** at the bottom of your About page. Its text is the `## How this site was made` section of [`site-text.md`](../site-text.md). Keep it true: if what you or the AI wrote changes, update it there.

## The guestbook

The [guestbook](https://emilianomanaloiv.github.io/guestbook/) is an old-internet guest list.

- **Where it lives:** the **Sign The Guestbook** discussion ([#6](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/discussions/6)) in the **Guestbook** category. It is pinned, so it's easy to find.
- **Signing:** visitors click "Sign the guestbook" on the site, which opens that discussion, and leave a comment with their GitHub account.
- **On the site:** each comment becomes a numbered signature, oldest first (#001, #002, …), with the visitor's username and date. Replies to a signature are not shown.
- **Links and images:** visitors can include links and pictures. Links are marked so search engines don't follow them, and only images hosted on GitHub are kept. Video clips in signatures are not shown.

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
4. A missing image or clip doesn't fail the run. Look for a warning that starts with "dropped", which says why, such as a clip over 10 MB or in HEVC.
5. To rebuild by hand, open the **Test and deploy** workflow and click **Run workflow**.

The hourly rebuild pauses after 60 days without any activity in the repository. Any post, comment, or manual run starts it again.
