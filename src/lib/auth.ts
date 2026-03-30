import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const ALLOWED_USERS = [
  { email: "roycebarboz@gmail.com", password: process.env.LOGIN_PASSWORD_1 },
  { email: "rbarboz@stevens.edu", password: process.env.LOGIN_PASSWORD_2 },
  // Add future users here:
  process.env.ALLOWED_EMAIL_3 ? { email: process.env.ALLOWED_EMAIL_3, password: process.env.LOGIN_PASSWORD_3 } : null,
  process.env.ALLOWED_EMAIL_4 ? { email: process.env.ALLOWED_EMAIL_4, password: process.env.LOGIN_PASSWORD_4 } : null,
  process.env.ALLOWED_EMAIL_5 ? { email: process.env.ALLOWED_EMAIL_5, password: process.env.LOGIN_PASSWORD_5 } : null,
].filter(Boolean) as { email: string; password: string | undefined }[];

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@stevens.edu" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = ALLOWED_USERS.find(
          (u) => u.email.toLowerCase() === email && u.password === password
        );

        if (!user) return null;

        return { id: email, email, name: email.split("@")[0] };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
      }
      return token;
    },
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
