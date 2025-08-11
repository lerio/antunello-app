"use client";

import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "../ui/dropdown-menu";
import { ChevronDown, User, LogOut } from "lucide-react";
import Link from "next/link";
import { signOutAction } from "@/app/actions";

interface UserMenuProps {
  displayName: string;
}

export function UserMenu({ displayName }: UserMenuProps) {
  const handleSignOut = async () => {
    await signOutAction();
  };
  return (
    <DropdownMenu
      trigger={
        <div className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors cursor-pointer touch-manipulation min-h-[44px]">
          <span className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base">
            {displayName}
          </span>
          <ChevronDown size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
        </div>
      }
    >
      <DropdownMenuItem>
        <Link 
          href="/protected/reset-password"
          className="flex items-center gap-2 w-full"
        >
          <User size={16} />
          Profile
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleSignOut}>
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <LogOut size={16} />
          Sign out
        </div>
      </DropdownMenuItem>
    </DropdownMenu>
  );
}