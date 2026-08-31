"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { listProjects } from "@/lib/projects";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [projects, setProjects] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        listProjects().then((d) => setProjects(d.projects)).catch(() => setProjects([]));
    }, []);

    function goToProject(id) {
        setDropdownOpen(false);
        router.push(`/project?project=${id}`);
    }

    return (
        <aside className={styles.sidebar}>
            <Link href="/home" className={`${styles.item} ${pathname === "/home" ? styles.active : ""}`}>
                Dashboard
            </Link>

            <div className={styles.section}>
                <button className={styles.item} onClick={() => setDropdownOpen((v) => !v)}
                        style={{width: "100%", textAlign: "left"}}>
                    Projects {dropdownOpen ? "▾" : "▸"}
                </button>
                {dropdownOpen && (
                    <div className={styles.dropdown}>
                        {projects.length === 0 ? (
                            <p className={styles.empty}>No projects yet.</p>
                        ) : (
                            projects.map((p) => (
                                <button key={p.id} className={styles.dropdownItem} onClick={() => goToProject(p.id)}>
                                    {p.name}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            <Link href="/templates" className={`${styles.item} ${pathname === "/templates" ? styles.active : ""}`}>
                Templates
            </Link>

            <Link href="/votes" className={`${styles.item} ${pathname === "/votes" ? styles.active : ""}`}>
                My Votes
            </Link>

            <div style={{flex: 1}}/>

            <Link href="/settings" className={`${styles.item} ${pathname === "/settings" ? styles.active : ""}`}>
                Settings
            </Link>
        </aside>
    );

}