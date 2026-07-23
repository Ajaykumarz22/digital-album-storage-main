// Shared FAQ content. Kept in a plain (non-"use client") module so it can be
// imported by both server components (the setup page) and the client Faq
// accordion without becoming a client-reference proxy.
export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What is Reel Pouches for?",
    a: "We all shoot important moments - weddings, baby birthdays, festivals, trips. We rarely open them again, yet we keep paying to store them on hard disks or regular cloud drives, which is expensive. Reel Pouches gives you Cold Drive storage that's up to 9× cheaper than the drives you use every day. The one trade-off: your files aren't available the instant you decide to store them - when you need them back it takes about 12-24 hours to “wake up” your data.",
  },
  {
    q: "What is Cold Drive?",
    a: "Cold Drive is very cheap, long-term storage for files you want to keep safe but don't need day to day - like old event photos and videos. Your files stay frozen and protected at the lowest possible cost. When you want them again, you “wake them up” (about 12-24 hours) for a small retrieval fee. It's best for memories you rarely open but never want to lose.",
  },
  {
    q: "What is Hot Drive?",
    a: "Hot Drive works just like Google Drive, OneDrive or Amazon Photos - your files are available instantly and it costs about the same. The difference: on Reel Pouches you can buy exactly the space you need, starting from just 20 GB. Other platforms make you buy 200 GB to 1 TB upfront - space you don't need yet but pay for from day one.",
  },
  {
    q: "What happens to my data after I store it in Cold Drive?",
    a: "Your files are copied into deep, long-term cold storage and kept frozen - stored on highly durable infrastructure with multiple redundant copies, so they stay safe and intact for the whole period you sign up for. While they're frozen you can't open or download them instantly. When you need something back you request it (\"wake it up\"), it becomes downloadable in about 12-24 hours for a small retrieval fee, and then it refreezes. Your files stay safe for as long as your Cold Drive plan is active.",
  },
];
