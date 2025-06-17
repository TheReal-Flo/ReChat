# ReChat - A(nother) AI wrapper like t3 chat

ReChat is an AI wrapper like t3 chat, built for it's OSS AI wrapper hackathon. It's built with Next.js, Tailwind CSS, and TypeScript.

> [!WARNING]  
> I hacked this page together in ~3 days for [the T3 chat cloneathon](https://cloneathon.t3.chat/) and refactored the entire codebase TWICE. For about 40% of the code, I don't even know what it does anymore. Please, for gods sake, try to understand what it does, before you use it in production. Anyways, feel free to clone it, hack around, and build your own features into it.

## Getting Started
After cloning the repo, copy the contents of `.env.example` to `.env.local` and fill in the values. I highly recommend you to use Convex, if you don't want to, you can disable it and use PostgreSQL/Redis instead, tho i don't guarantee it will work, as it's not tested.

When using Convex, please set `CONVEX_BASE_URL` in your Convex environment variables to your deployment URL.

Run the following commands:
```bash
npm install --legacy-peer-deps # I use an older version of shadcn/ui, so i need to use --legacy-peer-deps

npm run dev
```

## Features
ReChat is built with Next.js, Tailwind CSS, and TypeScript. It's using the following providers/libs:
- OpenAI API for image gen
- OpenRouter API for chat
- Redis for caching
- PostgreSQL for storing messages
- Clerk for auth
- UploadThing for storing attachments
- Convex for syncing
- Shadcn UI for components
- Serper for websearch

I've built in all of the features required for the hackathon, plus some additional features:
- [x] Attachment Support
- [x] Image Generation as tool call
- [x] Syntax Highlighting
- [x] Chat Branching
- [x] Web search
- [x] BYOK
- [x] Chat Memory
- [x] MCP support
- [ ] Chat Sharing (partially done)
- [ ] Own MCP/Tool endpoints

## Conclusion
I had a lot of fun throwing this together, and I really enjoyed working on it. I might come back to this at a future point someday, but for now, this project is complete.

## License
This project is published under the MIT License.

## Contributing
I probably won't take any contributions to this project, as it's marked as done for me. If you want to contribute to it, or continue it, please do a hard fork.