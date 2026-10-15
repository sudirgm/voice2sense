export const CURRICULUM = [
  {
    id: "dsa",
    title: "Data Structures & Algorithms",
    shortTitle: "DSA",
    icon: "🌲",
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
    description: "Master fundamental data structures and algorithm design for GATE, placements, and university exams.",
    chapters: [
      {
        id: "dsa-c1",
        title: "Chapter 1: Introduction & Arrays",
        chapterNum: 1,
        lessons: [
          { id: "dsa-c1-l1", title: "Introduction to Data Structures", keywords: ["data structure","dsa","introduction","intro","basics","overview","what is dsa"], videoId: "8hly31xKli0", startTime: 0, duration: "45 min", description: "A complete overview of data structures and how to approach learning them." },
          { id: "dsa-c1-l2", title: "Arrays — Indexing & Operations", keywords: ["array","arrays","static array","index","indexing","traversal"], videoId: "8hly31xKli0", startTime: 2700, duration: "35 min", description: "Static and dynamic arrays, zero-based indexing, insertion, deletion, Big-O complexity." },
          { id: "dsa-c1-l3", title: "Dynamic Arrays & Amortized Analysis", keywords: ["dynamic array","vector","resizing","amortized","arraylist","capacity"], videoId: "8hly31xKli0", startTime: 4800, duration: "30 min", description: "How dynamic arrays grow at runtime, amortized O(1) push cost." }
        ]
      },
      {
        id: "dsa-c2",
        title: "Chapter 2: Linked Lists",
        chapterNum: 2,
        lessons: [
          { id: "dsa-c2-l1", title: "Singly Linked Lists", keywords: ["linked list","singly linked","node","pointer","next","head","tail"], videoId: "8hly31xKli0", startTime: 6600, duration: "40 min", description: "Nodes, head/tail pointers, traversal, insertion, deletion in singly linked lists." },
          { id: "dsa-c2-l2", title: "Doubly & Circular Linked Lists", keywords: ["doubly linked","circular","prev","bidirectional","dll"], videoId: "8hly31xKli0", startTime: 9000, duration: "35 min", description: "Doubly linked list operations with prev/next pointers, circular list use cases." }
        ]
      },
      {
        id: "dsa-c3",
        title: "Chapter 3: Trees & Graphs",
        chapterNum: 3,
        lessons: [
          { id: "dsa-c3-l1", title: "Binary Trees & BST", keywords: ["tree","trees","binary tree","bst","binary search tree","root","leaf","inorder","preorder","postorder","traversal"], videoId: "8hly31xKli0", startTime: 11400, duration: "50 min", description: "Binary tree terminology, DFS traversals, Binary Search Tree operations." },
          { id: "dsa-c3-l2", title: "Graphs — BFS & DFS", keywords: ["graph","graphs","bfs","dfs","breadth first","depth first","adjacency"], videoId: "ZZuD6iUe3Pc", startTime: 0, duration: "55 min", description: "Graph representations, BFS for shortest path, DFS for cycle detection." },
          { id: "dsa-c3-l3", title: "Sorting Algorithms", keywords: ["sort","sorting","merge sort","quick sort","bubble sort","heap sort","insertion sort"], videoId: "ZZuD6iUe3Pc", startTime: 2400, duration: "60 min", description: "All major sorting algorithms with time-space complexity analysis." }
        ]
      }
    ]
  },
  {
    id: "dbms",
    title: "Database Management Systems",
    shortTitle: "DBMS",
    icon: "🗄️",
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #6d28d9, #8b5cf6)",
    description: "Relational databases, SQL, normalization, and transactions for GATE & university exams.",
    chapters: [
      {
        id: "dbms-c1",
        title: "Chapter 1: Fundamentals of DBMS",
        chapterNum: 1,
        lessons: [
          { id: "dbms-c1-l1", title: "Introduction to DBMS", keywords: ["dbms","database","introduction","rdbms","what is database","relational model"], videoId: "GFQaEYEc8_8", startTime: 0, duration: "40 min", description: "What is a DBMS, advantages over file systems, relational model, key terminology." },
          { id: "dbms-c1-l2", title: "ER Model & Entity Sets", keywords: ["er model","er diagram","entity","relationship","attribute","cardinality","participation"], videoId: "GFQaEYEc8_8", startTime: 2400, duration: "45 min", description: "Entity-Relationship diagrams, cardinality ratios, and participation constraints." }
        ]
      },
      {
        id: "dbms-c2",
        title: "Chapter 2: Normalization",
        chapterNum: 2,
        lessons: [
          { id: "dbms-c2-l1", title: "Functional Dependencies & 1NF / 2NF", keywords: ["normalization","functional dependency","1nf","2nf","first normal form","second normal form","partial dependency"], videoId: "GFQaEYEc8_8", startTime: 5400, duration: "50 min", description: "Functional dependencies, eliminating repeating groups (1NF), partial dependencies (2NF)." },
          { id: "dbms-c2-l2", title: "3NF, BCNF & Lossless Decomposition", keywords: ["3nf","bcnf","boyce codd","third normal form","anomaly","lossless","decomposition","transitive dependency"], videoId: "GFQaEYEc8_8", startTime: 8100, duration: "45 min", description: "3NF vs BCNF, transitive dependencies, lossless-join decomposition." }
        ]
      },
      {
        id: "dbms-c3",
        title: "Chapter 3: SQL",
        chapterNum: 3,
        lessons: [
          { id: "dbms-c3-l1", title: "SQL Basics — DDL & DML", keywords: ["sql","ddl","dml","select","insert","update","delete","create table","query"], videoId: "HXV3zeQKqGY", startTime: 0, duration: "60 min", description: "CREATE TABLE, INSERT, SELECT with WHERE/ORDER BY, UPDATE, DELETE with real examples." },
          { id: "dbms-c3-l2", title: "Joins & Subqueries", keywords: ["join","joins","inner join","outer join","left join","right join","subquery","nested query"], videoId: "HXV3zeQKqGY", startTime: 3600, duration: "55 min", description: "INNER JOIN, LEFT/RIGHT OUTER JOIN, FULL JOIN, correlated subqueries." },
          { id: "dbms-c3-l3", title: "Transactions & ACID Properties", keywords: ["transaction","acid","atomicity","consistency","isolation","durability","rollback","commit","concurrency","deadlock"], videoId: "HXV3zeQKqGY", startTime: 7200, duration: "40 min", description: "ACID guarantees, isolation levels, concurrency problems, deadlock handling." }
        ]
      }
    ]
  },
  {
    id: "os",
    title: "Operating Systems",
    shortTitle: "OS",
    icon: "⚙️",
    color: "#10b981",
    gradient: "linear-gradient(135deg, #065f46, #10b981)",
    description: "Processes, scheduling, memory management, and file systems for GATE and core CS interviews.",
    chapters: [
      {
        id: "os-c1",
        title: "Chapter 1: Processes & Threads",
        chapterNum: 1,
        lessons: [
          { id: "os-c1-l1", title: "Introduction to Operating Systems", keywords: ["os","operating system","introduction","kernel","system call","what is os"], videoId: "yK1uBHPdblU", startTime: 0, duration: "45 min", description: "What is an OS, its goals, types, and the kernel/user space model." },
          { id: "os-c1-l2", title: "Processes & Process States", keywords: ["process","processes","pcb","process control block","state","ready","running","blocked","context switch"], videoId: "yK1uBHPdblU", startTime: 2700, duration: "40 min", description: "Process lifecycle, PCB structure, and context switching." },
          { id: "os-c1-l3", title: "Threads & Concurrency", keywords: ["thread","threads","multithreading","concurrency","mutex","synchronization","race condition","semaphore"], videoId: "yK1uBHPdblU", startTime: 5100, duration: "45 min", description: "User vs kernel threads, race conditions, mutual exclusion, semaphores." }
        ]
      },
      {
        id: "os-c2",
        title: "Chapter 2: CPU Scheduling",
        chapterNum: 2,
        lessons: [
          { id: "os-c2-l1", title: "CPU Scheduling Algorithms", keywords: ["scheduling","cpu scheduling","fcfs","sjf","round robin","priority scheduling","gantt chart","waiting time","turnaround"], videoId: "yK1uBHPdblU", startTime: 7800, duration: "60 min", description: "FCFS, SJF, Round Robin, Priority Scheduling — Gantt charts and performance calculations." }
        ]
      },
      {
        id: "os-c3",
        title: "Chapter 3: Memory Management",
        chapterNum: 3,
        lessons: [
          { id: "os-c3-l1", title: "Memory Management & Paging", keywords: ["memory","paging","page table","virtual memory","segmentation","frame","logical address"], videoId: "yK1uBHPdblU", startTime: 11400, duration: "55 min", description: "Logical vs physical memory, paging, page tables, TLB, segmentation." },
          { id: "os-c3-l2", title: "Page Replacement Algorithms", keywords: ["page replacement","fifo","lru","optimal","page fault","thrashing","belady"], videoId: "yK1uBHPdblU", startTime: 14700, duration: "45 min", description: "FIFO, LRU, Optimal page replacement with worked examples. Belady anomaly." }
        ]
      }
    ]
  },
  {
    id: "cn",
    title: "Computer Networks",
    shortTitle: "Networks",
    icon: "🌐",
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #b45309, #f59e0b)",
    description: "OSI model, TCP/IP, routing, and network security for GATE and IT engineering exams.",
    chapters: [
      {
        id: "cn-c1",
        title: "Chapter 1: Fundamentals & OSI Model",
        chapterNum: 1,
        lessons: [
          { id: "cn-c1-l1", title: "Introduction to Computer Networks", keywords: ["network","networking","computer network","introduction","lan","wan","man","topology"], videoId: "qiQR5rTSshw", startTime: 0, duration: "40 min", description: "Network types (LAN/WAN/MAN), topologies, switching, and why we need computer networks." },
          { id: "cn-c1-l2", title: "OSI 7-Layer Model", keywords: ["osi","osi model","seven layer","7 layer","physical layer","data link","network layer","transport layer","application layer"], videoId: "qiQR5rTSshw", startTime: 2400, duration: "50 min", description: "All 7 OSI layers — functions, protocols, and real-world examples." }
        ]
      },
      {
        id: "cn-c2",
        title: "Chapter 2: TCP/IP & Protocols",
        chapterNum: 2,
        lessons: [
          { id: "cn-c2-l1", title: "TCP/IP Protocol Suite", keywords: ["tcp","ip","tcp/ip","protocol","ipv4","ipv6","subnet","subnetting","handshake","three way"], videoId: "qiQR5rTSshw", startTime: 5400, duration: "55 min", description: "TCP three-way handshake, IP addressing, subnetting with CIDR, routing basics." },
          { id: "cn-c2-l2", title: "HTTP, DNS & Application Protocols", keywords: ["http","https","dns","ftp","smtp","web","application layer","url","request response"], videoId: "qiQR5rTSshw", startTime: 8700, duration: "45 min", description: "HTTP request/response, DNS resolution, FTP, SMTP, and REST concepts." },
          { id: "cn-c2-l3", title: "Network Security & Encryption", keywords: ["security","encryption","ssl","tls","firewall","vpn","cryptography","symmetric","asymmetric","rsa"], videoId: "qiQR5rTSshw", startTime: 12600, duration: "50 min", description: "SSL/TLS, symmetric vs asymmetric encryption, firewalls, VPNs." }
        ]
      }
    ]
  }
];

export function findLessonById(lessonId) {
  for (const subject of CURRICULUM) {
    for (const chapter of subject.chapters) {
      for (const lesson of chapter.lessons) {
        if (lesson.id === lessonId) return { lesson, chapter, subject };
      }
    }
  }
  return null;
}

export function findNextLesson(lessonId) {
  const all = [];
  for (const subject of CURRICULUM) {
    for (const chapter of subject.chapters) {
      for (const lesson of chapter.lessons) {
        all.push({ lesson, chapter, subject });
      }
    }
  }
  const idx = all.findIndex(e => e.lesson.id === lessonId);
  if (idx !== -1 && idx < all.length - 1) return all[idx + 1];
  return null;
}

export function findPrevLesson(lessonId) {
  const all = [];
  for (const subject of CURRICULUM) {
    for (const chapter of subject.chapters) {
      for (const lesson of chapter.lessons) {
        all.push({ lesson, chapter, subject });
      }
    }
  }
  const idx = all.findIndex(e => e.lesson.id === lessonId);
  if (idx > 0) return all[idx - 1];
  return null;
}

export function searchCurriculum(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(t => t.length > 1);
  const results = [];
  for (const subject of CURRICULUM) {
    const subjectMatch = subject.title.toLowerCase().includes(q) || subject.shortTitle.toLowerCase() === q || subject.id === q;
    for (const chapter of subject.chapters) {
      for (const lesson of chapter.lessons) {
        let score = 0;
        if (subjectMatch) score += 3;
        if (lesson.title.toLowerCase().includes(q)) score += 5;
        if (chapter.title.toLowerCase().includes(q)) score += 2;
        for (const kw of lesson.keywords) {
          for (const token of tokens) {
            if (kw.includes(token) || token.includes(kw)) score += 2;
          }
        }
        if (score > 0) results.push({ lesson, chapter, subject, score });
      }
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

export function getLessonByChapterNum(subjectId, chapterNum, lessonIndex = 0) {
  const subject = CURRICULUM.find(s => s.id === subjectId);
  if (!subject) return null;
  const chapter = subject.chapters.find(c => c.chapterNum === chapterNum);
  if (!chapter || !chapter.lessons[lessonIndex]) return null;
  return { lesson: chapter.lessons[lessonIndex], chapter, subject };
}
