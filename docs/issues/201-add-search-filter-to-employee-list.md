# #201: Add Search Filter to Employee List

**Category:** [FRONTEND]
**Difficulty:** EASY
**Tags:** `search, filter, employee-management`

## Description

Add a search input field to the EmployeeList component that allows users to filter employees by name, position, or email in real-time.

## Problem

Currently, the EmployeeList component only supports sorting but has no way to quickly find specific employees when the list grows large.

## Acceptance Criteria

- [ ] Add a search input field above the employee table
- [ ] Filter employees by name, position, or email (case-insensitive)
- [ ] Show filtered results in real-time as the user types
- [ ] Display "No employees found" message when no results match the search
- [ ] Clear the search filter when the component unmounts

## Implementation Plan

1. Add search state to EmployeeList component
2. Add search input UI above the table
3. Implement filter logic based on search term
4. Handle empty state when no results found
