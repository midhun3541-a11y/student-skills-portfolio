document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('studentGrid');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const filterPillsContainer = document.getElementById('filterPills');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const themeToggleBtn = document.getElementById('themeToggle');
    const activeSortText = document.getElementById('activeSortText');

    // --- Dark Mode Logic ---
    // Pure CSS toggle, zero DOM re-rendering for maximum smoothness
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);

    themeToggleBtn.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        let newTheme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // --- Dynamic Header Height Adjustment ---
    // Ensures the first card is NEVER hidden under the fixed header
    const stickyHeader = document.querySelector('.sticky-header');

    function adjustBodyPadding() {
        if (!stickyHeader) return;
        const headerH = stickyHeader.offsetHeight;
        const safeOffset = headerH + 24; // 24px guaranteed buffer
        document.body.style.paddingTop = safeOffset + 'px';
    }

    // Run multiple passes to catch font loading and layout shifts
    adjustBodyPadding();                           // Immediate
    setTimeout(adjustBodyPadding, 100);            // After short layout settle
    setTimeout(adjustBodyPadding, 500);            // After web fonts load
    window.addEventListener('resize', adjustBodyPadding);

    // Watch for header size changes (e.g. filter pills appearing/disappearing)
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(adjustBodyPadding).observe(stickyHeader);
    }

    if (typeof studentData === 'undefined') {
        grid.innerHTML = '<p class="no-results">Error: Data could not be loaded.</p>';
        return;
    }

    // Helper functions
    const escapeHTML = (str) => {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    };

    const getInitials = (name) => {
        if (!name) return '?';
        const parts = String(name).trim().split(/\s+/).filter(p => p.length > 0);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const highlightText = (text, search) => {
        const safeText = String(text);
        if (!search) return escapeHTML(safeText);
        
        const lowerText = safeText.toLowerCase();
        const lowerSearch = search.toLowerCase();
        const startIndex = lowerText.indexOf(lowerSearch);
        
        if (startIndex === -1) return escapeHTML(safeText);
        
        const before = safeText.substring(0, startIndex);
        const match = safeText.substring(startIndex, startIndex + search.length);
        const after = safeText.substring(startIndex + search.length);
        
        return escapeHTML(before) + '<span class="highlight">' + escapeHTML(match) + '</span>' + highlightText(after, search);
    };

    // --- Advanced Stars Rendering ---
    function renderStars(level) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            const isFilled = i <= level;
            const delay = i * 0.1;
            
            const emptySvg = `<svg class="star-icon star-empty" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
            
            let filledSvg = '';
            if (isFilled) {
                filledSvg = `<svg class="star-icon star-filled" style="transition-delay: ${delay}s;" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
            }
            
            starsHtml += `<div class="star-wrapper">${emptySvg}${filledSvg}</div>`;
        }
        return starsHtml;
    }

    // Prepare data
    const excludeKeys = ["Name", "Roll Number ", "📝 A note about yourself ", "A note about yourself "];
    let allSkillsSet = new Set();
    
    const processedData = studentData.map(student => {
        const name = (student["Name"] || "Unknown").trim();
        const rollStr = student["Roll Number "];
        const rollNumber = parseInt(rollStr) || 0;
        const note = (student["📝 A note about yourself "] || student["A note about yourself "] || "").trim();
        
        let teamName = "Unknown";
        if (typeof teamMapping !== 'undefined') {
            if (teamMapping[rollNumber]) teamName = teamMapping[rollNumber];
            else if (teamMapping[name]) teamName = teamMapping[name];
            else if (teamMapping[rollStr]) teamName = teamMapping[rollStr];
            else {
                const mappedTeam = Object.keys(teamMapping).find(k => k.includes(String(rollNumber)) || k.includes(name));
                if (mappedTeam) teamName = teamMapping[mappedTeam];
            }
        }

        let skills = [];
        let totalScore = 0;

        for (const key in student) {
            if (!excludeKeys.includes(key)) {
                const level = parseInt(student[key]) || 0;
                if (level > 0) {
                    skills.push({ name: key.trim(), level: level });
                    totalScore += level;
                    allSkillsSet.add(key.trim());
                }
            }
        }
        skills.sort((a, b) => b.level - a.level);

        return {
            name, rollString: rollStr || "N/A", rollNumber, team: teamName, note, skills, totalScore,
            searchString: `${name.toLowerCase()} ${skills.map(s=>s.name.toLowerCase()).join(' ')} ${teamName.toLowerCase()}`
        };
    });

    // State
    let state = {
        searchTerm: '',
        selectedFilters: new Set(),
        sortBy: 'roll-asc'
    };

    function updateActiveSortLabel() {
        const selectedOption = sortSelect.options[sortSelect.selectedIndex];
        if (selectedOption) {
            activeSortText.textContent = selectedOption.text;
        }
    }

    let activeDropdown = null;

    function closeDropdowns() {
        if (activeDropdown) {
            activeDropdown.remove();
            activeDropdown = null;
        }
    }
    
    document.addEventListener('click', closeDropdowns);
    window.addEventListener('resize', closeDropdowns);
    window.addEventListener('scroll', closeDropdowns, {passive: true});

    function openDropdown(e, skill, btnRef) {
        e.stopPropagation();
        closeDropdowns();
        
        const rect = btnRef.getBoundingClientRect();
        const dropdown = document.createElement('div');
        dropdown.className = 'custom-dropdown-menu';
        dropdown.style.top = `${rect.bottom + window.scrollY + 8}px`;
        dropdown.style.left = `${rect.left + window.scrollX}px`;
        
        const isFiltered = state.selectedFilters.has(skill);
        
        dropdown.innerHTML = `
            <div class="dropdown-item checkbox-item" id="dd-filter">
                <input type="checkbox" ${isFiltered ? 'checked' : ''} id="chk-${skill}">
                <label for="chk-${skill}" style="cursor:pointer; width:100%;">Filter matches only</label>
            </div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item" id="dd-sort-desc">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
                Sort High → Low
            </div>
            <div class="dropdown-item" id="dd-sort-asc">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="18 15 12 9 6 15"></polyline></svg>
                Sort Low → High
            </div>
        `;
        
        document.body.appendChild(dropdown);
        const dropRect = dropdown.getBoundingClientRect();
        if (dropRect.right > window.innerWidth) {
            dropdown.style.left = `${window.innerWidth - dropRect.width - 10}px`;
        }

        requestAnimationFrame(() => dropdown.classList.add('show'));
        activeDropdown = dropdown;
        
        dropdown.addEventListener('click', (ev) => ev.stopPropagation());

        dropdown.querySelector('#dd-filter').addEventListener('click', (ev) => {
            const chk = document.getElementById(`chk-${skill}`);
            if (ev.target.tagName !== 'INPUT') {
                chk.checked = !chk.checked;
            }
            if (chk.checked) {
                state.selectedFilters.add(skill);
                btnRef.classList.add('active');
            } else {
                state.selectedFilters.delete(skill);
                btnRef.classList.remove('active');
            }
            updateClearButton();
            renderInstant(); // Update instantly without skeleton
        });
        
        dropdown.querySelector('#dd-sort-desc').addEventListener('click', () => {
            state.sortBy = `skill-desc-${skill}`;
            sortSelect.value = state.sortBy;
            updateActiveSortLabel();
            renderInstant();
            closeDropdowns();
        });
        
        dropdown.querySelector('#dd-sort-asc').addEventListener('click', () => {
            state.sortBy = `skill-asc-${skill}`;
            sortSelect.value = state.sortBy;
            updateActiveSortLabel();
            renderInstant();
            closeDropdowns();
        });
    }

    const sortedAllSkills = Array.from(allSkillsSet).sort();
    
    const skillOptGroup = document.createElement('optgroup');
    skillOptGroup.label = "Sort by Specific Skill";
    sortedAllSkills.forEach(skill => {
        skillOptGroup.innerHTML += `
            <option value="skill-desc-${skill}">${skill} (High → Low)</option>
            <option value="skill-asc-${skill}">${skill} (Low → High)</option>
        `;
    });
    sortSelect.appendChild(skillOptGroup);

    sortedAllSkills.forEach(skill => {
        const wrapper = document.createElement('div');
        wrapper.className = 'filter-pill-wrapper';

        const btn = document.createElement('button');
        btn.className = 'filter-pill';
        btn.innerHTML = `${skill} <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        
        btn.addEventListener('click', (e) => openDropdown(e, skill, btn));
        
        wrapper.appendChild(btn);
        filterPillsContainer.appendChild(wrapper);
    });

    // --- Advanced Clear Buttons Reset ---
    clearFiltersBtn.addEventListener('click', () => {
        clearFiltersBtn.classList.add('resetting');
        setTimeout(() => clearFiltersBtn.classList.remove('resetting'), 400);

        // Fully reset states
        state.selectedFilters.clear();
        state.searchTerm = '';
        state.sortBy = 'roll-asc';
        
        // Reset DOM Inputs instantly
        searchInput.value = '';
        sortSelect.value = 'roll-asc';
        document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
        
        updateClearButton();
        updateActiveSortLabel();
        renderInstant(); // Full instant render without flicker
    });

    function updateClearButton() {
        clearFiltersBtn.style.display = state.selectedFilters.size > 0 || state.searchTerm.length > 0 || state.sortBy !== 'roll-asc' ? 'inline-flex' : 'none';
    }

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            state.searchTerm = e.target.value.trim().toLowerCase();
            updateClearButton();
            renderInstant();
        }, 200);
    });

    sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        updateActiveSortLabel();
        updateClearButton();
        renderInstant();
    });

    // --- Infinite Scroll & Fast Render ---
    let currentFiltered = [];
    let currentlyRendered = 0;
    const CHUNK_SIZE = 24;
    
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) renderNextChunk();
    }, { rootMargin: '400px' });

    // Renders instantly to avoid flicker on fast updates like clear filters
    function renderInstant() {
        applyFiltersAndSort();
        grid.innerHTML = '';
        currentlyRendered = 0;
        observer.disconnect();
        
        if (currentFiltered.length === 0) {
            grid.innerHTML = '<p class="no-results">No students found matching criteria.</p>';
            return;
        }
        
        renderNextChunk();
    }

    function applyFiltersAndSort() {
        currentFiltered = processedData.filter(student => {
            if (state.selectedFilters.size > 0) {
                let hasAny = false;
                for (let i = 0; i < student.skills.length; i++) {
                    if (state.selectedFilters.has(student.skills[i].name)) {
                        hasAny = true; break;
                    }
                }
                if (!hasAny) return false;
            }

            if (state.searchTerm) {
                if (!student.searchString.includes(state.searchTerm)) return false;
            }

            return true;
        });

        currentFiltered.sort((a, b) => {
            const parts = state.sortBy.split('-');
            const type = parts[0];
            const dir = parts[1];

            if (type === 'name') return dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            else if (type === 'roll') return dir === 'asc' ? a.rollNumber - b.rollNumber : b.rollNumber - a.rollNumber;
            else if (type === 'score') return dir === 'asc' ? a.totalScore - b.totalScore : b.totalScore - a.totalScore;
            else if (type === 'skill') {
                const skillName = parts.slice(2).join('-');
                let aLevel = 0; for(let i=0; i<a.skills.length; i++) { if(a.skills[i].name === skillName) { aLevel = a.skills[i].level; break; } }
                let bLevel = 0; for(let i=0; i<b.skills.length; i++) { if(b.skills[i].name === skillName) { bLevel = b.skills[i].level; break; } }
                
                if (aLevel !== bLevel) return dir === 'asc' ? aLevel - bLevel : bLevel - aLevel;
                return b.totalScore - a.totalScore;
            }
            return 0;
        });
    }

    function renderNextChunk() {
        const fragment = document.createDocumentFragment();
        const end = Math.min(currentlyRendered + CHUNK_SIZE, currentFiltered.length);
        
        for (let i = currentlyRendered; i < end; i++) {
            const student = currentFiltered[i];
            const card = document.createElement('div');
            card.className = 'card';
            card.style.animationDelay = `${Math.min((i % CHUNK_SIZE) * 0.05, 0.5)}s`;

            const header = document.createElement('div');
            header.className = 'card-header';
            
            const displayTitle = highlightText(student.name, state.searchTerm);
            
            const teamClass = student.team !== 'Unknown' ? student.team.toLowerCase() : '';
            const teamBadge = student.team !== 'Unknown'
                ? `<span class="team-badge team-${teamClass}">${escapeHTML(student.team)}</span>`
                : `<span class="team-badge team-placeholder"></span>`;

            header.innerHTML = `
                <div class="card-header-left">
                    <div class="avatar">${getInitials(student.name)}</div>
                    <div class="card-info">
                        <div class="student-name" title="${escapeHTML(student.name)}">${displayTitle}</div>
                        <div class="card-meta">
                            <span class="roll-badge">Roll: ${escapeHTML(student.rollString)}</span>
                        </div>
                        <div class="card-team">
                            ${teamBadge}
                        </div>
                    </div>
                </div>
                <div class="card-header-right">
                    <div class="score-badge" title="Total Score">
                        <span class="score-value">${student.totalScore}</span>
                        <span class="score-label">pts</span>
                    </div>
                    <div class="expand-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>
            `;

            const content = document.createElement('div');
            content.className = 'card-content';
            
            let skillsHTML = '<div class="card-content-inner"><div class="skills-list">';
            if (student.skills.length === 0) {
                skillsHTML += '<div class="skill-row" style="color: var(--text-secondary)">No specific skills listed</div>';
            } else {
                student.skills.forEach(s => {
                    const skillNameDisp = highlightText(s.name, state.searchTerm);
                    skillsHTML += `
                        <div class="skill-row">
                            <span class="skill-name">${skillNameDisp}</span>
                            <div class="stars-container" title="Level ${s.level}/5">
                                ${renderStars(s.level)}
                            </div>
                        </div>
                    `;
                });
            }
            skillsHTML += '</div></div>';

            if (student.note && student.note !== '-' && student.note !== '.') {
                skillsHTML += `<div class="note">"${escapeHTML(student.note)}"</div>`;
            }
            
            content.innerHTML = skillsHTML;

            header.addEventListener('click', () => {
                const isExpanded = card.classList.contains('expanded');

                if (isExpanded) {
                    // Collapse: set explicit height first, then transition to 0
                    content.style.maxHeight = content.scrollHeight + 'px';
                    // Force reflow so browser registers the starting value
                    content.offsetHeight;
                    content.style.maxHeight = '0px';
                    content.style.opacity = '0';
                    card.classList.remove('expanded');
                } else {
                    // Expand: transition to exact scrollHeight
                    card.classList.add('expanded');
                    content.style.maxHeight = content.scrollHeight + 'px';
                    content.style.opacity = '1';
                    // After transition completes, remove inline max-height so content can reflow naturally
                    const onEnd = () => {
                        if (card.classList.contains('expanded')) {
                            content.style.maxHeight = 'none';
                        }
                        content.removeEventListener('transitionend', onEnd);
                    };
                    content.addEventListener('transitionend', onEnd);
                }
            });

            if (state.searchTerm && student.skills.some(s => s.name.toLowerCase().includes(state.searchTerm))) {
                card.classList.add('expanded');
                // Set to auto after a frame so it's immediately visible
                requestAnimationFrame(() => {
                    content.style.maxHeight = content.scrollHeight + 'px';
                    content.style.opacity = '1';
                    requestAnimationFrame(() => { content.style.maxHeight = 'none'; });
                });
            }

            card.appendChild(header);
            card.appendChild(content);
            fragment.appendChild(card);
        }

        grid.appendChild(fragment);
        currentlyRendered = end;
        
        if (currentlyRendered < currentFiltered.length) {
            const lastCard = grid.lastElementChild;
            if (lastCard) observer.observe(lastCard);
        }
    }

    updateActiveSortLabel();
    
    // Initial Render
    // Using skeletons only on initial load for a nice entry feel, then fast subsequent renders
    grid.innerHTML = '';
    for(let i = 0; i < 8; i++) {
        const skel = document.createElement('div');
        skel.className = 'skeleton-card';
        grid.appendChild(skel);
    }
    setTimeout(() => {
        renderInstant();
    }, 150);
});
