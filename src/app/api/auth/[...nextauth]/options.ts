// lib/nextAuthOptions.ts
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@site.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValid) return null;

        // return minimal user object - will be stored in JWT
        return { id: user.id, email: user.email, name: user.name ?? null };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // on sign-in, attach user id
      console.log("JWT callback user:", token);
      if (user) {

        token.user = user;
      }
      return token;
    },
    async session({ session, token }) {
      // make id available in session
      if (token && (token as any).user) {
        (session as any).user = {
          ...(session.user ?? {}),
          id: (token as any).user.id ?? (token as any).user?.id,
          email: (token as any).user.email,
          name: (token as any).user.name,
        };
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
