import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "WordQuiz Pro - Practice Vocabulary in a Fun Way",
  description: "Practice vocabulary in a fun and engaging way with WordQuiz Pro",
  openGraph: {
    title: "WordQuiz Pro - Practice Vocabulary in a Fun Way",
    description: "Practice vocabulary in a fun and engaging way with WordQuiz Pro",
    url: "https://www.wordquizpro.vercel.app",
    siteName: "WordQuiz Pro",
    images: [
      {
        url: "https://raw.githubusercontent.com/PatelAbhay550/wordquiz-pro/refs/heads/main/public/wordquiz%20pro.png",
        width: 1200,
        height: 630,
        alt: "WordQuiz Pro",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  authors: [
    {
      name: "Abhay Patel",
      url: "https://github.com/PatelAbhay550",
    },
  ],
  creator: "Abhay Patel",
  publisher: "Abhay Patel",
  keywords: [
    "WordQuiz Pro",
    "Vocabulary Practice",
    "Language Learning",
    "Fun Learning",
    "Educational App",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
         <Providers>
        {children}</Providers>
      </body>
    </html>
  );
}
