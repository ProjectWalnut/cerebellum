flowchart LR
    style StageParallel fill:#f9f,stroke:#333,stroke-width:1px
    subgraph "Stage: Parallel Mode"
      A[Context In] -->|spawn tasks| B[Task 1]
      A --> C[Task 2]
      A --> D[Task 3]
      B & C & D --> E[Promise.all ⇒ [results]]
      E --> F[Callback(results)]
      F --> G[Context Out]
    end

flowchart TD
    style StageConditional fill:#ff9,stroke:#333,stroke-width:1px
    subgraph "Stage: Conditional Mode"
      A[Context In] --> B[/nextTasks(context)/]
      B -->|[], stop| F[Callback(context.previous)]
      B -->|[TaskX,…]| C[run TaskX]
      C --> D[update context.previous]
      D --> B
      F --> G[Context Out]
    end
