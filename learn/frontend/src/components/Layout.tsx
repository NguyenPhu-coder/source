import Header from "./Header";
import Footer from "./Footer";
import ChatBot from "./ChatBot";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 pt-20">{children}</main>
      <Footer />
      <ChatBot />
    </div>
  );
}
