'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteProject } from '@/lib/actions'
import ProjectCard from '@/components/ui/ProjectCard'

const BULK_DELETE_CONCURRENCY = 3

type ProjectListItem = {
  id: string
  name: string
  description: string | null
  board: {
    tasks: { status: string }[]
  } | null
  createdAt: Date | string
}

interface ProjectsSectionProps {
  projects: ProjectListItem[]
}

export default function ProjectsSection({ projects }: ProjectsSectionProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const selectedIdSet = useMemo(() => new Set(selectedProjectIds), [selectedProjectIds])

  const handleToggleSelect = (projectId: string) => {
    setSelectedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId]
    )
  }

  const handleCancelSelection = () => {
    if (isDeleting) return
    setIsSelectionMode(false)
    setSelectedProjectIds([])
  }

  const handleDeleteSelected = async () => {
    if (isDeleting || selectedProjectIds.length === 0) return
    const confirmed = window.confirm(
      selectedProjectIds.length === 1
        ? 'Delete this project? This cannot be undone.'
        : `Delete ${selectedProjectIds.length} projects? This cannot be undone.`
    )
    if (!confirmed) return

    setIsDeleting(true)

    try {
      const idsToDelete = [...selectedProjectIds]
      const projectNameById = new Map(projects.map((project) => [project.id, project.name]))
      const results: PromiseSettledResult<string>[] = new Array(idsToDelete.length)
      let nextIndex = 0

      const runDeleteWorker = async () => {
        while (true) {
          const currentIndex = nextIndex++
          if (currentIndex >= idsToDelete.length) {
            return
          }

          const projectId = idsToDelete[currentIndex]
          try {
            await deleteProject(projectId)
            results[currentIndex] = { status: 'fulfilled', value: projectId }
          } catch (error) {
            results[currentIndex] = { status: 'rejected', reason: error }
          }
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(BULK_DELETE_CONCURRENCY, idsToDelete.length) },
          () => runDeleteWorker()
        )
      )

      const deletedProjectIds: string[] = []
      const failedProjectIds: string[] = []

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          deletedProjectIds.push(result.value)
        } else {
          failedProjectIds.push(idsToDelete[index])
        }
      })

      if (deletedProjectIds.length > 0) {
        router.refresh()
      }

      if (failedProjectIds.length > 0) {
        const failedIdSet = new Set(failedProjectIds)
        const failedNames = failedProjectIds.map((id) => projectNameById.get(id) ?? id)
        setSelectedProjectIds((current) => current.filter((id) => failedIdSet.has(id)))
        window.alert(`Failed to delete: ${failedNames.join(', ')}`)
      } else {
        setIsSelectionMode(false)
        setSelectedProjectIds([])
      }
    } catch (error) {
      console.error('[ProjectsSection] Failed to delete selected projects', error)
      window.alert('Failed to delete selected projects. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Projects</h2>

        {isSelectionMode ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500">{selectedProjectIds.length} selected</p>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={isDeleting || selectedProjectIds.length === 0}
              className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? 'Deleting…' : 'Delete Selected'}
            </button>
            <button
              type="button"
              onClick={handleCancelSelection}
              disabled={isDeleting}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </p>
            <button
              type="button"
              onClick={() => setIsSelectionMode(true)}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Select
            </button>
          </div>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-center">
          <div>
            <h3 className="text-base font-semibold text-gray-800">No projects yet</h3>
            <p className="mt-1 text-sm text-gray-500">Create your first project to start planning work.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              selectionMode={isSelectionMode}
              isSelected={selectedIdSet.has(project.id)}
              onSelect={handleToggleSelect}
              disabled={isDeleting}
            />
          ))}
        </div>
      )}
    </section>
  )
}
