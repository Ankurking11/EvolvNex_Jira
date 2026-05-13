'use client'

import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppProject } from '@/lib/board-types'

interface ProjectStateContextValue {
  projects: AppProject[]
  upsertProject: (project: AppProject) => void
}

const ProjectStateContext = createContext<ProjectStateContextValue | null>(null)

function getProjectSnapshot(projects: AppProject[]) {
  return {
    projectIds: projects.map((project) => project.id),
    projectCount: projects.length,
    boardIds: projects.map((project) => project.board?.id ?? null),
  }
}

function getProjectSignature(projects: AppProject[]) {
  return projects
    .map((project) =>
      [
        project.id,
        project.name,
        project.description ?? '',
        String(project.updatedAt),
        project.board?.id ?? '',
        project.board?._count.tasks ?? 0,
        project.members.length,
      ].join(':')
    )
    .join('|')
}

export function ProjectStateProvider({
  children,
  initialProjects,
}: {
  children: ReactNode
  initialProjects: AppProject[]
}) {
  const [optimisticProjects, setOptimisticProjects] = useState<AppProject[]>([])
  const projects = useMemo(() => {
    const serverProjectIds = new Set(initialProjects.map((project) => project.id))
    const optimisticOnlyProjects = optimisticProjects.filter((project) => !serverProjectIds.has(project.id))
    return [...optimisticOnlyProjects, ...initialProjects]
  }, [initialProjects, optimisticProjects])
  const previousProjectsSignatureRef = useRef(getProjectSignature(projects))

  useEffect(() => {
    console.debug('[ProjectStateProvider] AppShell hydration', getProjectSnapshot(initialProjects))
  }, [initialProjects])

  useEffect(() => {
    const previousProjectsSignature = previousProjectsSignatureRef.current
    const nextProjectsSignature = getProjectSignature(projects)

    if (previousProjectsSignature !== nextProjectsSignature) {
      console.debug('[ProjectStateProvider] Project list state updated', {
        reason: 'derived-sync',
        beforeSignature: previousProjectsSignature,
        afterSignature: nextProjectsSignature,
        snapshot: getProjectSnapshot(projects),
      })
      previousProjectsSignatureRef.current = nextProjectsSignature
    }
  }, [projects])

  const value = useMemo<ProjectStateContextValue>(
    () => ({
      projects,
      upsertProject: (project) => {
        setOptimisticProjects((previousProjects) => {
          const existingProjectIndex = previousProjects.findIndex((existingProject) => existingProject.id === project.id)
          const nextProjects = existingProjectIndex >= 0
            ? previousProjects.map((existingProject) => (existingProject.id === project.id ? project : existingProject))
            : [project, ...previousProjects]

          console.debug('[ProjectStateProvider] Project list state updated', {
            reason: existingProjectIndex >= 0 ? 'optimistic-replace' : 'optimistic-insert',
            projectId: project.id,
            before: getProjectSnapshot(previousProjects),
            after: getProjectSnapshot(nextProjects),
          })

          return nextProjects
        })
      },
    }),
    [projects]
  )

  return <ProjectStateContext.Provider value={value}>{children}</ProjectStateContext.Provider>
}

export function useProjectState() {
  const context = useContext(ProjectStateContext)
  if (!context) {
    throw new Error('useProjectState must be used within ProjectStateProvider')
  }

  return context
}
